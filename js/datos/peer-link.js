// Sincronización directa entre dos móviles en la misma red, por WebRTC (PeerJS).
// Solo se conectan si conocen el mismo token; después intercambian sus operaciones pendientes,
// y cada cambio local se envía al momento a los móviles conectados.
import { TABLES, request, transaction } from './db.js';
import { readMeta } from './store.js';
import { applyRemoteOps, hashToken } from '../logica/peer-sync.js';

const PREFIJO_SALA = 'canculator-';
const MAX_IDS_APLICADOS = 5000;
const ESPERA_REINTENTO_MS = 5000;

// Conexiones verificadas ahora mismo. Cada una lleva la cuenta de lo que ya ha enviado.
const conectadas = new Set();
const oyentesConectadas = new Set();

function avisarConectadas() {
  for (const avisar of oyentesConectadas) avisar(conectadas.size);
}

// Al recargar o cerrar la página, cierra las conexiones para que el otro móvil reintente enseguida
// (si no, tarda lo que tarda WebRTC en darse cuenta de que el enlace murió).
globalThis.addEventListener('pagehide', () => {
  for (const registro of conectadas) registro.conexion.close();
});

// Avisa con el número de móviles conectados cada vez que cambia. Devuelve la función para dejar de oír.
export function alCambiarConectadas(avisar) {
  oyentesConectadas.add(avisar);
  return () => oyentesConectadas.delete(avisar);
}

// Crea (o vuelve a abrir) una sala con ese código. Devuelve { cerrar }.
// Si el código aún está registrado en el servicio (p. ej. tras reiniciar), reintenta solo.
export function createRoom({ db, code, token, onOps, onFotos, onStatus }) {
  let peer = null;
  let timer = null;
  let cerrada = false;

  const abrir = () => {
    if (cerrada) return;
    peer = new window.Peer(PREFIJO_SALA + code);
    peer.on('connection', (conexion) => prepararConexion({ db, conexion, token, onOps, onFotos, onStatus }));
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
// Si el anfitrión aún no está registrado (p. ej. tras recargar su app), también llama a onClosed.
export function joinRoom({ db, code, token, onOps, onFotos, onStatus, onClosed }) {
  const peer = new window.Peer();
  peer.on('open', () => {
    onStatus('Uniéndose a la sala…');
    prepararConexion({ db, conexion: peer.connect(PREFIJO_SALA + code), token, onOps, onFotos, onStatus, onClosed });
  });
  peer.on('error', (e) => {
    if (e.type === 'peer-unavailable') {
      onStatus('La sala aún no está disponible; reintentando…');
      peer.destroy();
      onClosed?.();
    } else {
      onStatus(`No se pudo unir: ${e.type}`);
    }
  });
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
function prepararConexion({ db, conexion, token, onOps, onFotos, onStatus, onClosed }) {
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
      avisarConectadas();
      onStatus('Conectado. Sincronizando…');
      const pendientes = await operacionesPendientes(db);
      pendientes.forEach((o) => registro.enviados.add(o.id));
      conexion.send({ tipo: 'operaciones', operaciones: pendientes });
    } else if (mensaje?.tipo === 'operaciones' && verificado) {
      await onOps(mensaje.operaciones ?? []);
      await pedirFotosFaltantes(db, conexion);
    } else if (mensaje?.tipo === 'pedir-fotos' && verificado) {
      await enviarFotos(db, conexion, mensaje.ids ?? []);
    } else if (mensaje?.tipo === 'foto' && verificado) {
      if (await guardarFotoRecibida(db, mensaje.foto)) {
        onFotos?.();
        // Las miniaturas que ya están en pantalla leen la foto al enterarse.
        globalThis.dispatchEvent(new CustomEvent('foto-recibida', { detail: mensaje.foto.id }));
      }
    }
  });

  conexion.on('close', () => {
    conectadas.delete(registro);
    avisarConectadas();
    onStatus('La conexión se ha cerrado.');
    onClosed?.();
  });
  conexion.on('error', (e) => onStatus(`Error en la conexión: ${e.type}`));
}

// Las operaciones solo llevan el id de la foto: los bytes se piden aparte, una foto por mensaje.
async function pedirFotosFaltantes(db, conexion) {
  const { lotes, fotos } = await transaction(db, [TABLES.lotes, TABLES.fotos], 'readonly', async (tx) => ({
    lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
    fotos: await request(tx.objectStore(TABLES.fotos).getAll()),
  }));
  const tengo = new Set(fotos.flatMap((f) => [f.id, f.drive_id].filter(Boolean)));
  const faltan = [...new Set(lotes.filter((l) => !l.borrado && l.foto_id && !tengo.has(l.foto_id)).map((l) => l.foto_id))];
  if (faltan.length > 0 && conexion.open) conexion.send({ tipo: 'pedir-fotos', ids: faltan });
}

async function enviarFotos(db, conexion, ids) {
  for (const id of ids) {
    const foto = await readPhotoRecord(db, id);
    if (foto && conexion.open) {
      conexion.send({ tipo: 'foto', foto: { id, tipo: foto.tipo, creada: foto.creada, bytes: foto.bytes } });
    }
  }
}

function readPhotoRecord(db, id) {
  return transaction(db, [TABLES.fotos], 'readonly', async (tx) => {
    const almacen = tx.objectStore(TABLES.fotos);
    return (await request(almacen.get(id))) ?? (await request(almacen.getAll())).find((f) => f.drive_id === id) ?? null;
  });
}

async function guardarFotoRecibida(db, foto) {
  if (!foto?.id || !foto.bytes) return false;
  return transaction(db, [TABLES.fotos], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLES.fotos);
    if (await request(almacen.get(foto.id))) return false;
    almacen.put({ id: foto.id, bytes: foto.bytes, tipo: foto.tipo || 'image/jpeg', creada: foto.creada });
    return true;
  });
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
