// Sincronización con el servidor (Apps Script). La lógica de reglas está en js/logica/sincronizacion.js.
import { TABLAS, peticion, transaccion } from './db.js';
import { ACCIONES, aplicarCambiosServidor, construirPeticionSync, entidadesPendientes, idsConfirmados, interpretarRespuestaSync } from '../logica/sincronizacion.js';
import { editarLote, guardarMeta, leerMeta } from './tienda.js';
import { activo } from '../logica/inventario.js';

export const TIMEOUT_SYNC_MS = 30_000;
const CLAVE_ULTIMA = 'ultima_sincronizacion';

export class SinConexion extends Error {
  constructor() {
    super('Sin conexión. Los cambios se guardan y se enviarán más tarde.');
    this.name = 'SinConexion';
  }
}

// Envía una petición POST como text/plain: así el navegador no pide un "preflight" CORS.
export async function enviarPeticion(url, cuerpo, fetchFn = globalThis.fetch.bind(globalThis)) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_SYNC_MS);
  let respuesta;
  try {
    respuesta = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      redirect: 'follow',
      signal: controlador.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new SinConexion();
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error('El servidor no respondió con datos válidos. Revisa la URL de Apps Script.');
  }
}

let enCurso = null;

// Una sincronización a la vez: si ya hay una en marcha, se devuelve esa.
export function sincronizarDatos(db, opciones) {
  if (!enCurso) {
    enCurso = sincronizarDatosUnaVez(db, opciones).finally(() => { enCurso = null; });
  }
  return enCurso;
}

async function sincronizarDatosUnaVez(db, { url, token, dispositivo, fetchFn }) {
  const [operaciones, configuracion, desde] = await Promise.all([
    transaccion(db, [TABLAS.operaciones], 'readonly', (tx) => peticion(tx.objectStore(TABLAS.operaciones).getAll())),
    transaccion(db, [TABLAS.configuracion], 'readonly', (tx) => peticion(tx.objectStore(TABLAS.configuracion).getAll())),
    leerMeta(db, CLAVE_ULTIMA),
  ]);
  operaciones.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const peticionSync = construirPeticionSync({ token, dispositivo, operaciones, desde, configuracion });
  const respuesta = interpretarRespuestaSync(await enviarPeticion(url, peticionSync, fetchFn));
  const confirmados = idsConfirmados(respuesta);

  // Todo en una transacción: borrar lo confirmado y aplicar lo recibido.
  const resumen = await transaccion(db, [TABLAS.productos, TABLAS.lotes, TABLAS.configuracion, TABLAS.operaciones], 'readwrite', async (tx) => {
    const almacenOps = tx.objectStore(TABLAS.operaciones);
    for (const id of confirmados) almacenOps.delete(id);
    const pendientesAhora = (await peticion(almacenOps.getAll())).filter((o) => !confirmados.has(o.id));

    const local = {
      productos: await peticion(tx.objectStore(TABLAS.productos).getAll()),
      lotes: await peticion(tx.objectStore(TABLAS.lotes).getAll()),
      configuracion: await peticion(tx.objectStore(TABLAS.configuracion).getAll()),
    };
    const nuevo = aplicarCambiosServidor(local, respuesta.cambios ?? {}, entidadesPendientes(pendientesAhora));
    for (const [tabla, almacen] of [['productos', TABLAS.productos], ['lotes', TABLAS.lotes]]) {
      const store = tx.objectStore(almacen);
      for (const r of nuevo[tabla]) store.put(r);
    }
    const storeConf = tx.objectStore(TABLAS.configuracion);
    for (const c of nuevo.configuracion) {
      storeConf.put({ clave: c.clave, valor: c.valor, actualizado: c.actualizado ?? '' });
    }
    return {
      enviadas: operaciones.length,
      confirmadas: confirmados.size,
      pendientes: pendientesAhora.length,
      recibidos: Object.values(respuesta.cambios ?? {}).reduce((s, l) => s + l.length, 0),
    };
  });

  await guardarMeta(db, CLAVE_ULTIMA, respuesta.ahora);
  return { ...resumen, ahora: respuesta.ahora, avisos: respuesta.avisos ?? [] };
}

// Sube las fotos que aún no están en Drive. Un fallo en una foto no para las demás ni los datos.
export async function subirFotosPendientes(db, { url, token, dispositivo, fetchFn }) {
  const [fotos, lotes] = await Promise.all([
    transaccion(db, [TABLAS.fotos], 'readonly', (tx) => peticion(tx.objectStore(TABLAS.fotos).getAll())),
    transaccion(db, [TABLAS.lotes], 'readonly', (tx) => peticion(tx.objectStore(TABLAS.lotes).getAll())),
  ]);
  const referenciadas = new Map(lotes.filter(activo).filter((l) => l.foto_id).map((l) => [l.foto_id, l]));
  const pendientes = fotos.filter((f) => !f.drive_id && referenciadas.has(f.id));

  const subidas = [];
  const errores = [];
  for (const foto of pendientes) {
    try {
      const dato = base64DeBytes(foto.bytes);
      const r = await enviarPeticion(url, {
        accion: ACCIONES.FOTO, token, nombre: `${foto.id}.jpg`, tipo: foto.tipo, dato,
      }, fetchFn);
      if (r.ok !== true || !r.id) throw new Error(r.error || 'Drive no devolvió un id');
      await transaccion(db, [TABLAS.fotos], 'readwrite', (tx) => {
        tx.objectStore(TABLAS.fotos).put({ ...foto, drive_id: r.id });
      });
      // El lote pasa a llevar el id de Drive; el cambio viaja como una operación más.
      await editarLote(db, dispositivo, referenciadas.get(foto.id).id, { foto_id: r.id });
      subidas.push(foto.id);
    } catch (error) {
      errores.push(`${foto.id}: ${error.message}`);
    }
  }
  return { subidas: subidas.length, errores };
}

function base64DeBytes(buffer) {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

// Ciclo completo: datos, luego fotos, y si hubo fotos subidas, otra vuelta de datos.
export async function sincronizarTodo(db, opciones) {
  const datos = await sincronizarDatos(db, opciones);
  const fotos = await subirFotosPendientes(db, opciones);
  if (fotos.subidas > 0) {
    const segunda = await sincronizarDatos(db, opciones);
    return { datos: segunda, fotos };
  }
  return { datos, fotos };
}
