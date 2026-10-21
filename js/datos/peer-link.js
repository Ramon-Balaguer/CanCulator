// Sincronización directa entre dos móviles en la misma red, por WebRTC (PeerJS).
// Solo se conectan si conocen el mismo token; después intercambian sus operaciones pendientes,
// y cada cambio local se envía al momento a los móviles conectados.
import { TABLES, request, transaction } from './db.js';
import { readMeta } from './store.js';
import { applyRemoteOps, hashToken } from '../logica/peer-sync.js';

const PREFIJO_SALA = 'inventario-casa-';
const MAX_IDS_APLICADOS = 5000;
const ESPERA_REINTENTO_MS = 5000;

// Conexiones verificadas ahora mismo. Cada una lleva la cuenta de lo que ya ha enviado.
const conectadas = new Set();

// Crea (o vuelve a abrir) una sala con ese código. Devuelve { cerrar }.
// Si el código aún está registrado en el servicio (p. ej. tras reiniciar), reintenta solo.
export function createRoom({ db, code, token, onOps, onStatus }) {
  let peer = null;
  let timer = null;
  let cerrada = false;

  const abrir = () => {
    if (cerrada) return;
    peer = new window.Peer(PREFIJO_SALA + code);
    peer.on('connection', (conexion) => prepararConexion({ db, conexion, token, onOps, onStatus }));
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        onStatus('La sala aún está activa en el servicio; reintentando…');
        peer.destroy();
        timer = setTimeout(abrir, ESPERA_REINTENTO_MS);
      } else {
        onStatus(`Error de la sala: ${e.type}`);
      }
    });
    onStatus('Sala abierta. Esperando al otro móvil…');
  };

  abrir();
  return {
    cerrar: () => {
      cerrada = true;
      clearTimeout(timer);
      peer?.destroy();
    },
  };
}

// Se une a la sala con ese código. Si la conexión se cae, llama a onClosed (para reintentar).
export function joinRoom({ db, code, token, onOps, onStatus, onClosed }) {
  const peer = new window.Peer();
  peer.on('open', () => {
    onStatus('Uniéndose a la sala…');
    prepararConexion({ db, conexion: peer.connect(PREFIJO_SALA + code), token, onOps, onStatus, onClosed });
  });
  peer.on('error', (e) => onStatus(`No se pudo unir: ${e.type}`));
  return { cerrar: () => peer.destroy() };
}

// Envía a los móviles conectados las operaciones que aún no les han llegado.
// Se llama después de cada cambio local.
export async function enviarCambiosPendientes() {
  for (const registro of conectadas) {
    if (!registro.conexion.open) continue;
    const pendientes = await operacionesPendientes(registro.db);
    const nuevas = pendientes.filter((o) => !registro.enviados.has(o.id));
    if (nuevas.length === 0) continue;
    registro.conexion.send({ tipo: 'operaciones', operaciones: nuevas });
    nuevas.forEach((o) => registro.enviados.add(o.id));
  }
}

// Protocolo: saludo (huella del token). Si coincide, se envían las operaciones pendientes
// y, a partir de ahí, cada cambio local nuevo.
function prepararConexion({ db, conexion, token, onOps, onStatus, onClosed }) {
  const miHuellaPromesa = hashToken(token);
  const registro = { conexion, db, enviados: new Set() };
  let verificado = false;

  conexion.on('open', async () => {
    conexion.send({ tipo: 'saludo', huella: await miHuellaPromesa });
  });

  conexion.on('data', async (mensaje) => {
    if (mensaje?.tipo === 'saludo') {
      if (mensaje.huella !== (await miHuellaPromesa)) {
        onStatus('Los móviles no tienen el mismo token: no se sincroniza.');
        conexion.close();
        return;
      }
      verificado = true;
      conectadas.add(registro);
      onStatus('Conectado. Sincronizando…');
      const pendientes = await operacionesPendientes(db);
      pendientes.forEach((o) => registro.enviados.add(o.id));
      conexion.send({ tipo: 'operaciones', operaciones: pendientes });
    } else if (mensaje?.tipo === 'operaciones' && verificado) {
      onOps(mensaje.operaciones ?? []);
    }
  });

  conexion.on('close', () => {
    conectadas.delete(registro);
    onStatus('La conexión se ha cerrado.');
    onClosed?.();
  });
  conexion.on('error', (e) => onStatus(`Error en la conexión: ${e.type}`));
}

async function operacionesPendientes(db) {
  return transaction(db, [TABLES.operaciones], 'readonly', (tx) => request(tx.objectStore(TABLES.operaciones).getAll()));
}

// Aplica operaciones recibidas: guarda los registros cambiados y los ids ya aplicados,
// para no aplicar dos veces una misma operación aunque llegue otra vez.
export async function applyPeerOperations(db, deviceId, operations) {
  const guardados = await readMeta(db, 'peer_applied_ids');
  const yaAplicados = new Set(Array.isArray(guardados) ? guardados : []);
  const nuevas = operations.filter((o) => o.dispositivo !== deviceId);

  return transaction(db, [TABLES.productos, TABLES.lotes, TABLES.meta], 'readwrite', async (tx) => {
    const productos = await request(tx.objectStore(TABLES.productos).getAll());
    const lotes = await request(tx.objectStore(TABLES.lotes).getAll());
    const { state, applied } = applyRemoteOps({ productos, lotes }, nuevas, yaAplicados);
    if (applied.length === 0) return 0;
    for (const p of state.productos) tx.objectStore(TABLES.productos).put(p);
    for (const l of state.lotes) tx.objectStore(TABLES.lotes).put(l);
    const todos = [...yaAplicados, ...applied].slice(-MAX_IDS_APLICADOS);
    tx.objectStore(TABLES.meta).put({ clave: 'peer_applied_ids', valor: todos });
    return applied.length;
  });
}
