// Sincronización directa entre dos móviles en la misma red, por WebRTC (PeerJS).
// Solo se conectan si conocen el mismo token; después intercambian sus operaciones pendientes.
import { TABLES, request, transaction } from './db.js';
import { readMeta } from './store.js';
import { applyRemoteOps, hashToken } from '../logica/peer-sync.js';

const PREFIJO_SALA = 'inventario-casa-';
const MAX_IDS_APLICADOS = 5000;

// Crea una sala con el código dado. Devuelve { cerrar }.
export function createRoom({ db, code, token, onOps, onStatus }) {
  const peer = new window.Peer(PREFIJO_SALA + code);
  peer.on('connection', (conexion) => prepararConexion({ db, conexion, token, onOps, onStatus }));
  peer.on('error', (e) => onStatus(`Error de la sala: ${e.type}`));
  onStatus('Sala creada. Esperando al otro móvil…');
  return { cerrar: () => peer.destroy() };
}

// Se une a la sala con ese código. Devuelve { cerrar }.
export function joinRoom({ db, code, token, onOps, onStatus }) {
  const peer = new window.Peer();
  peer.on('open', () => {
    onStatus('Uniéndose a la sala…');
    prepararConexion({ db, conexion: peer.connect(PREFIJO_SALA + code), token, onOps, onStatus });
  });
  peer.on('error', (e) => onStatus(`No se pudo unir: ${e.type}`));
  return { cerrar: () => peer.destroy() };
}

// Protocolo: saludo (huella del token). Si coincide, cada lado envía sus operaciones pendientes.
function prepararConexion({ db, conexion, token, onOps, onStatus }) {
  const miHuellaPromesa = hashToken(token);
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
      onStatus('Conectado. Sincronizando…');
      conexion.send({ tipo: 'operaciones', operaciones: await operacionesPendientes(db) });
    } else if (mensaje?.tipo === 'operaciones' && verificado) {
      onOps(mensaje.operaciones ?? []);
    }
  });

  conexion.on('close', () => onStatus('La conexión se ha cerrado.'));
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
