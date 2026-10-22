// Query of names from Open Food Facts with a local cache (store cache_off).
// It never throws for lack of network: it returns a state and the entry goes on with the name by hand.
import { TABLES, request, transaction } from './db.js';
import { savePhoto } from './store.js';
import { isCacheValid, offPhotoId, parseResponse, productUrl } from '../logica/openfoodfacts.js';
import { frontImageUrl } from '../logica/off-category.js';

export const OFF_TIMEOUT_MS = 8000;

// Reads the product stored in the cache, without going to the network. Null if nothing is stored.
export async function readCacheOFF(db, code) {
  const entry = await transaction(db, [TABLES.cacheOff], 'readonly', (tx) => request(tx.objectStore(TABLES.cacheOff).get(code)));
  return entry?.encontrado ? entry.producto ?? null : null;
}

// Keeps the front photo of the product in the local database, so the app shows it offline.
// Best effort: without network nothing is stored, and the next query tries again. Never throws.
export async function keepOFFPhoto(db, code, producto, fetchFn) {
  try {
    const url = frontImageUrl(producto);
    if (!url) return;
    const saved = await transaction(db, [TABLES.cacheOff], 'readonly', (tx) => request(tx.objectStore(TABLES.cacheOff).get(code)));
    if (saved?.foto_off) return;
    const response = await fetchFn(url, { signal: AbortSignal.timeout(OFF_TIMEOUT_MS) });
    if (!response.ok) return;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return;
    const id = offPhotoId(code);
    await savePhoto(db, blob, id);
    await transaction(db, [TABLES.cacheOff], 'readwrite', async (tx) => {
      const store = tx.objectStore(TABLES.cacheOff);
      const entry = await request(store.get(code));
      if (entry) store.put({ ...entry, foto_off: id });
    });
  } catch {
    // Without the photo the product works the same: the lot photo or no photo at all.
  }
}

export const STATES = Object.freeze({
  ENCONTRADO: 'encontrado',
  NO_ENCONTRADO: 'no-encontrado',
  SIN_CONEXION: 'sin-conexion',
  ERROR: 'error',
});

async function requestOFF(code, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    const response = await fetchFn(productUrl(code), { signal: controller.signal, headers: { Accept: 'application/json' } });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // A body that is not JSON is treated as an unexpected response further down.
    }
    return parseResponse(response.status, body);
  } finally {
    clearTimeout(timer);
  }
}

// Returns { estado, nombre?, marca? }. The origin (cache or network) goes in "origen" for debugging.
export async function queryOFF(db, code, { fetchFn = globalThis.fetch.bind(globalThis), ahora: now = new Date() } = {}) {
  const saved = await transaction(db, [TABLES.cacheOff], 'readonly', (tx) => request(tx.objectStore(TABLES.cacheOff).get(code)));
  if (isCacheValid(saved, now)) {
    if (saved.encontrado) void keepOFFPhoto(db, code, saved.producto, fetchFn);
    return saved.encontrado
      ? { estado: STATES.ENCONTRADO, nombre: saved.nombre, marca: saved.marca, producto: saved.producto, origen: 'cache' }
      : { estado: STATES.NO_ENCONTRADO, origen: 'cache' };
  }

  let result;
  try {
    result = await requestOFF(code, fetchFn);
  } catch (error) {
    // A network failure (rejected fetch or timeout) is not stored: it is retried next time.
    if (error.name === 'AbortError' || error instanceof TypeError) {
      return { estado: STATES.SIN_CONEXION, origen: 'red' };
    }
    return { estado: STATES.ERROR, mensaje: error.message, origen: 'red' };
  }

  const entry = {
    codigo: code,
    encontrado: result.encontrado,
    nombre: result.nombre ?? '',
    marca: result.marca ?? '',
    producto: result.producto ?? null,
    consultado: now.toISOString(),
  };
  await transaction(db, [TABLES.cacheOff], 'readwrite', (tx) => { tx.objectStore(TABLES.cacheOff).put(entry); });
  if (result.encontrado) void keepOFFPhoto(db, code, result.producto, fetchFn);

  return result.encontrado
    ? { estado: STATES.ENCONTRADO, nombre: entry.nombre, marca: entry.marca, producto: entry.producto, origen: 'red' }
    : { estado: STATES.NO_ENCONTRADO, origen: 'red' };
}
