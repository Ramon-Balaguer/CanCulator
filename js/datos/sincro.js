// Sincronización con el servidor (Apps Script). La lógica de reglas está en js/logica/sincronizacion.js.
import { TABLES, request, transaction } from './db.js';
import { ACTIONS, applyServerChanges, buildSyncRequest, pendingEntities, confirmedIds, parseSyncResponse } from '../logica/sincronizacion.js';
import { editLot, saveMeta, readMeta } from './tienda.js';
import { isActive } from '../logica/inventario.js';

export const SYNC_TIMEOUT_MS = 30_000;
const LAST_SYNC_KEY = 'ultima_sincronizacion';

export class Offline extends Error {
  constructor() {
    super('Sin conexión. Los cambios se guardan y se enviarán más tarde.');
    this.name = 'SinConexion';
  }
}

// Envía una petición POST como text/plain: así el navegador no pide un "preflight" CORS.
export async function sendRequest(url, body, fetchFn = globalThis.fetch.bind(globalThis)) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  let response;
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Offline();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('El servidor no respondió con datos válidos. Revisa la URL de Apps Script.');
  }
}

let running = null;

// Una sincronización a la vez: si ya hay una en marcha, se devuelve esa.
export function syncData(db, options) {
  if (!running) {
    running = syncDataOnce(db, options).finally(() => { running = null; });
  }
  return running;
}

async function syncDataOnce(db, { url, token, dispositivo: device, fetchFn }) {
  const [operations, configuration, since] = await Promise.all([
    transaction(db, [TABLES.operaciones], 'readonly', (tx) => request(tx.objectStore(TABLES.operaciones).getAll())),
    transaction(db, [TABLES.configuracion], 'readonly', (tx) => request(tx.objectStore(TABLES.configuracion).getAll())),
    readMeta(db, LAST_SYNC_KEY),
  ]);
  operations.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const syncRequest = buildSyncRequest({ token, dispositivo: device, operaciones: operations, desde: since, configuracion: configuration });
  const response = parseSyncResponse(await sendRequest(url, syncRequest, fetchFn));
  const confirmed = confirmedIds(response);

  // Todo en una transacción: borrar lo confirmado y aplicar lo recibido.
  const summary = await transaction(db, [TABLES.productos, TABLES.lotes, TABLES.configuracion, TABLES.operaciones], 'readwrite', async (tx) => {
    const opsStore = tx.objectStore(TABLES.operaciones);
    for (const id of confirmed) opsStore.delete(id);
    const pendingNow = (await request(opsStore.getAll())).filter((o) => !confirmed.has(o.id));

    const local = {
      productos: await request(tx.objectStore(TABLES.productos).getAll()),
      lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
      configuracion: await request(tx.objectStore(TABLES.configuracion).getAll()),
    };
    const newItem = applyServerChanges(local, response.cambios ?? {}, pendingEntities(pendingNow));
    for (const [table, objectStore] of [['productos', TABLES.productos], ['lotes', TABLES.lotes]]) {
      const store = tx.objectStore(objectStore);
      for (const r of newItem[table]) store.put(r);
    }
    const configStore = tx.objectStore(TABLES.configuracion);
    for (const c of newItem.configuracion) {
      configStore.put({ clave: c.clave, valor: c.valor, actualizado: c.actualizado ?? '' });
    }
    return {
      enviadas: operations.length,
      confirmadas: confirmed.size,
      pendientes: pendingNow.length,
      recibidos: Object.values(response.cambios ?? {}).reduce((s, l) => s + l.length, 0),
    };
  });

  await saveMeta(db, LAST_SYNC_KEY, response.ahora);
  return { ...summary, ahora: response.ahora, avisos: response.avisos ?? [] };
}

// Sube las fotos que aún no están en Drive. Un fallo en una foto no para las demás ni los datos.
export async function uploadPendingPhotos(db, { url, token, dispositivo: device, fetchFn }) {
  const [photos, lots] = await Promise.all([
    transaction(db, [TABLES.fotos], 'readonly', (tx) => request(tx.objectStore(TABLES.fotos).getAll())),
    transaction(db, [TABLES.lotes], 'readonly', (tx) => request(tx.objectStore(TABLES.lotes).getAll())),
  ]);
  const referenced = new Map(lots.filter(isActive).filter((l) => l.foto_id).map((l) => [l.foto_id, l]));
  const pending = photos.filter((f) => !f.drive_id && referenced.has(f.id));

  const uploaded = [];
  const errors = [];
  for (const photo of pending) {
    try {
      const item = encodeBytesSync(photo.bytes);
      const r = await sendRequest(url, {
        accion: ACTIONS.FOTO, token, nombre: `${photo.id}.jpg`, tipo: photo.tipo, dato: item,
      }, fetchFn);
      if (r.ok !== true || !r.id) throw new Error(r.error || 'Drive no devolvió un id');
      await transaction(db, [TABLES.fotos], 'readwrite', (tx) => {
        tx.objectStore(TABLES.fotos).put({ ...photo, drive_id: r.id });
      });
      // El lote pasa a llevar el id de Drive; el cambio viaja como una operación más.
      await editLot(db, device, referenced.get(photo.id).id, { foto_id: r.id });
      uploaded.push(photo.id);
    } catch (error) {
      errors.push(`${photo.id}: ${error.message}`);
    }
  }
  return { subidas: uploaded.length, errores: errors };
}

function encodeBytesSync(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// Ciclo completo: datos, luego fotos, y si hubo fotos subidas, otra vuelta de datos.
export async function syncAll(db, options) {
  const data = await syncData(db, options);
  const photos = await uploadPendingPhotos(db, options);
  if (photos.subidas > 0) {
    const second = await syncData(db, options);
    return { datos: second, fotos: photos };
  }
  return { datos: data, fotos: photos };
}
