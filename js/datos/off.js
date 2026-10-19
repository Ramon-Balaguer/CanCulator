// Consulta de nombres a Open Food Facts con caché local (store cache_off).
// Nunca lanza por falta de red: devuelve un estado y el alta sigue con el nombre a mano.
import { TABLAS, peticion, transaccion } from './db.js';
import { cacheVigente, interpretarRespuesta, urlProducto } from '../logica/openfoodfacts.js';

export const TIMEOUT_OFF_MS = 8000;

export const ESTADOS = Object.freeze({
  ENCONTRADO: 'encontrado',
  NO_ENCONTRADO: 'no-encontrado',
  SIN_CONEXION: 'sin-conexion',
  ERROR: 'error',
});

async function pedirAOFF(codigo, fetchFn) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_OFF_MS);
  try {
    const respuesta = await fetchFn(urlProducto(codigo), { signal: controlador.signal, headers: { Accept: 'application/json' } });
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch {
      // Un cuerpo que no es JSON se trata como respuesta inesperada más abajo.
    }
    return interpretarRespuesta(respuesta.status, cuerpo);
  } finally {
    clearTimeout(temporizador);
  }
}

// Devuelve { estado, nombre?, marca? }. El origen (caché o red) va en "origen" para depurar.
export async function consultarOFF(db, codigo, { fetchFn = globalThis.fetch.bind(globalThis), ahora = new Date() } = {}) {
  const guardada = await transaccion(db, [TABLAS.cacheOff], 'readonly', (tx) => peticion(tx.objectStore(TABLAS.cacheOff).get(codigo)));
  if (cacheVigente(guardada, ahora)) {
    return guardada.encontrado
      ? { estado: ESTADOS.ENCONTRADO, nombre: guardada.nombre, marca: guardada.marca, origen: 'cache' }
      : { estado: ESTADOS.NO_ENCONTRADO, origen: 'cache' };
  }

  let resultado;
  try {
    resultado = await pedirAOFF(codigo, fetchFn);
  } catch (error) {
    // Un fallo de red (fetch rechazado o timeout) no se guarda: se reintenta la próxima vez.
    if (error.name === 'AbortError' || error instanceof TypeError) {
      return { estado: ESTADOS.SIN_CONEXION, origen: 'red' };
    }
    return { estado: ESTADOS.ERROR, mensaje: error.message, origen: 'red' };
  }

  const entrada = { codigo, encontrado: resultado.encontrado, nombre: resultado.nombre ?? '', marca: resultado.marca ?? '', consultado: ahora.toISOString() };
  await transaccion(db, [TABLAS.cacheOff], 'readwrite', (tx) => { tx.objectStore(TABLAS.cacheOff).put(entrada); });

  return resultado.encontrado
    ? { estado: ESTADOS.ENCONTRADO, nombre: entrada.nombre, marca: entrada.marca, origen: 'red' }
    : { estado: ESTADOS.NO_ENCONTRADO, origen: 'red' };
}
