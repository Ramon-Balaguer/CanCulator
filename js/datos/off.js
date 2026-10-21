// Consulta de nombres a Open Food Facts con caché local (store cache_off).
// Nunca lanza por falta de red: devuelve un estado y el alta sigue con el nombre a mano.
import { TABLES, request, transaction } from './db.js';
import { isCacheValid, parseResponse, productUrl } from '../logica/openfoodfacts.js';

export const OFF_TIMEOUT_MS = 8000;

// Lee el producto guardado en caché, sin ir a la red. Null si no hay nada guardado.
export async function readCacheOFF(db, code) {
  const entry = await transaction(db, [TABLES.cacheOff], 'readonly', (tx) => request(tx.objectStore(TABLES.cacheOff).get(code)));
  return entry?.encontrado ? entry.producto ?? null : null;
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
      // Un cuerpo que no es JSON se trata como respuesta inesperada más abajo.
    }
    return parseResponse(response.status, body);
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve { estado, nombre?, marca? }. El origen (caché o red) va en "origen" para depurar.
export async function queryOFF(db, code, { fetchFn = globalThis.fetch.bind(globalThis), ahora: now = new Date() } = {}) {
  const saved = await transaction(db, [TABLES.cacheOff], 'readonly', (tx) => request(tx.objectStore(TABLES.cacheOff).get(code)));
  if (isCacheValid(saved, now)) {
    return saved.encontrado
      ? { estado: STATES.ENCONTRADO, nombre: saved.nombre, marca: saved.marca, producto: saved.producto, origen: 'cache' }
      : { estado: STATES.NO_ENCONTRADO, origen: 'cache' };
  }

  let result;
  try {
    result = await requestOFF(code, fetchFn);
  } catch (error) {
    // Un fallo de red (fetch rechazado o timeout) no se guarda: se reintenta la próxima vez.
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

  return result.encontrado
    ? { estado: STATES.ENCONTRADO, nombre: entry.nombre, marca: entry.marca, producto: entry.producto, origen: 'red' }
    : { estado: STATES.NO_ENCONTRADO, origen: 'red' };
}
