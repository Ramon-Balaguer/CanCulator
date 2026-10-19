// Acciones sobre el inventario. Cada una escribe el registro y su operación en la misma
// transacción, así nunca queda un cambio sin su entrada en la cola de sincronización.
import { TABLAS, peticion, transaccion } from './db.js';
import { activo, buscarLoteIgual } from '../logica/inventario.js';
import { esFechaISO } from '../logica/fechas.js';

export const TIPOS_OPERACION = Object.freeze(['crear', 'editar', 'consumir', 'reponer', 'borrar']);

const ahora = () => new Date().toISOString();

// Sin crypto.randomUUID (navegadores antiguos) no hay forma segura de generar ids: se avisa.
export function nuevoId() {
  if (!globalThis.crypto?.randomUUID) throw new Error('Este navegador no puede generar identificadores');
  return crypto.randomUUID();
}

export function nuevaOperacion({ dispositivo, tipo, entidad, entidad_id, cambio = {}, fecha = ahora(), id = nuevoId() }) {
  if (!TIPOS_OPERACION.includes(tipo)) throw new Error(`Tipo de operación desconocido: ${tipo}`);
  return { id, dispositivo, fecha, tipo, entidad, entidad_id, cambio };
}

// Lee el id del dispositivo; si no existe, lo crea. Vive en Meta, no en Configuracion,
// para que no viaje en las copias JSON ni en la sincronización.
export async function dispositivoId(db) {
  return transaccion(db, [TABLAS.meta], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLAS.meta);
    const actual = await peticion(almacen.get('dispositivo_id'));
    if (actual?.valor) return actual.valor;
    const valor = nuevoId();
    almacen.put({ clave: 'dispositivo_id', valor });
    return valor;
  });
}

function validarProducto(datos) {
  const nombre = String(datos.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!nombre) throw new Error('El producto necesita un nombre');
  const minimo = Number(datos.stock_minimo ?? 0);
  if (!Number.isInteger(minimo) || minimo < 0) throw new Error('El stock mínimo debe ser un entero de 0 o más');
  return {
    nombre,
    categoria: String(datos.categoria ?? 'otros'),
    codigo_barras: String(datos.codigo_barras ?? '').trim(),
    stock_minimo: minimo,
  };
}

function validarLote(datos) {
  const cantidad = Number(datos.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un entero de 1 o más');
  if (!esFechaISO(datos.caducidad)) throw new Error('La caducidad debe tener formato AAAA-MM-DD');
  if (!datos.ubicacion) throw new Error('Elige una ubicación');
  return cantidad;
}

// Crea un producto. Si ya hay uno con ese código de barras, devuelve ese.
export function crearProducto(db, dispositivo, datos) {
  const limpio = validarProducto(datos);
  return transaccion(db, [TABLAS.productos, TABLAS.operaciones], 'readwrite', async (tx) => {
    const productos = await peticion(tx.objectStore(TABLAS.productos).getAll());
    if (limpio.codigo_barras) {
      const igual = productos.find((p) => activo(p) && p.codigo_barras === limpio.codigo_barras);
      if (igual) return igual;
    }
    const producto = { id: nuevoId(), ...limpio, actualizado: ahora(), borrado: false };
    tx.objectStore(TABLAS.productos).put(producto);
    tx.objectStore(TABLAS.operaciones).put(nuevaOperacion({
      dispositivo, tipo: 'crear', entidad: 'producto', entidad_id: producto.id, cambio: { ...limpio },
    }));
    return producto;
  });
}

export function editarProducto(db, dispositivo, id, cambios) {
  return transaccion(db, [TABLAS.productos, TABLAS.operaciones], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLAS.productos);
    const actual = await peticion(almacen.get(id));
    if (!actual) throw new Error('Producto no encontrado');
    const limpio = validarProducto({ ...actual, ...cambios });
    const cambio = Object.fromEntries(Object.entries(limpio).filter(([k, v]) => actual[k] !== v));
    if (Object.keys(cambio).length === 0) return actual;
    const producto = { ...actual, ...cambio, actualizado: ahora() };
    almacen.put(producto);
    tx.objectStore(TABLAS.operaciones).put(nuevaOperacion({
      dispositivo, tipo: 'editar', entidad: 'producto', entidad_id: id, cambio,
    }));
    return producto;
  });
}

// Alta de unidades. Si ya existe un lote del mismo producto, caducidad y ubicación,
// se suman a ese lote (reposición) en lugar de crear otro.
export function altaLote(db, dispositivo, datos) {
  const cantidad = validarLote(datos);
  return transaccion(db, [TABLAS.lotes, TABLAS.operaciones], 'readwrite', async (tx) => {
    const lotes = await peticion(tx.objectStore(TABLAS.lotes).getAll());
    const operaciones = tx.objectStore(TABLAS.operaciones);
    const igual = buscarLoteIgual(lotes, { producto_id: datos.producto_id, caducidad: datos.caducidad, ubicacion: datos.ubicacion });
    if (igual) {
      const lote = { ...igual, cantidad: igual.cantidad + cantidad, actualizado: ahora() };
      tx.objectStore(TABLAS.lotes).put(lote);
      operaciones.put(nuevaOperacion({
        dispositivo, tipo: 'reponer', entidad: 'lote', entidad_id: lote.id, cambio: { cantidad },
      }));
      return lote;
    }
    const lote = {
      id: nuevoId(),
      producto_id: datos.producto_id,
      cantidad,
      caducidad: datos.caducidad,
      ubicacion: datos.ubicacion,
      observaciones: String(datos.observaciones ?? '').trim(),
      foto_id: datos.foto_id ?? '',
      revisar: 'no',
      actualizado: ahora(),
      borrado: false,
    };
    tx.objectStore(TABLAS.lotes).put(lote);
    operaciones.put(nuevaOperacion({
      dispositivo, tipo: 'crear', entidad: 'lote', entidad_id: lote.id,
      cambio: {
        producto_id: lote.producto_id,
        cantidad,
        caducidad: lote.caducidad,
        ubicacion: lote.ubicacion,
        observaciones: lote.observaciones,
        foto_id: lote.foto_id,
      },
    }));
    return lote;
  });
}

// Consumir o reponer unidades de un lote: siempre incrementos, nunca un valor fijo.
export function ajustarLote(db, dispositivo, loteId, delta) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('El cambio debe ser un entero distinto de 0');
  return transaccion(db, [TABLAS.lotes, TABLAS.operaciones], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLAS.lotes);
    const actual = await peticion(almacen.get(loteId));
    if (!actual || !activo(actual)) throw new Error('Lote no encontrado');
    if (actual.cantidad + delta < 0) throw new Error('No puedes consumir más unidades de las que hay en el lote');
    const lote = { ...actual, cantidad: actual.cantidad + delta, actualizado: ahora() };
    almacen.put(lote);
    tx.objectStore(TABLAS.operaciones).put(nuevaOperacion({
      dispositivo,
      tipo: delta < 0 ? 'consumir' : 'reponer',
      entidad: 'lote',
      entidad_id: loteId,
      cambio: { cantidad: delta },
    }));
    return lote;
  });
}

export const consumir = (db, dispositivo, loteId, unidades = 1) => ajustarLote(db, dispositivo, loteId, -unidades);
export const reponer = (db, dispositivo, loteId, unidades = 1) => ajustarLote(db, dispositivo, loteId, unidades);

export function editarLote(db, dispositivo, id, cambios) {
  return transaccion(db, [TABLAS.lotes, TABLAS.operaciones], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLAS.lotes);
    const actual = await peticion(almacen.get(id));
    if (!actual || !activo(actual)) throw new Error('Lote no encontrado');
    const campos = {
      caducidad: cambios.caducidad ?? actual.caducidad,
      ubicacion: cambios.ubicacion ?? actual.ubicacion,
    };
    if (!esFechaISO(campos.caducidad)) throw new Error('La caducidad debe tener formato AAAA-MM-DD');
    if (!campos.ubicacion) throw new Error('Elige una ubicación');
    const nuevo = {
      observaciones: cambios.observaciones !== undefined ? String(cambios.observaciones).trim() : actual.observaciones,
      foto_id: cambios.foto_id ?? actual.foto_id,
    };
    const cambio = Object.fromEntries(
      Object.entries({ ...campos, ...nuevo }).filter(([k, v]) => actual[k] !== v),
    );
    if (Object.keys(cambio).length === 0) return actual;
    const lote = { ...actual, ...cambio, actualizado: ahora() };
    almacen.put(lote);
    tx.objectStore(TABLAS.operaciones).put(nuevaOperacion({
      dispositivo, tipo: 'editar', entidad: 'lote', entidad_id: id, cambio,
    }));
    return lote;
  });
}

// Borrado lógico: nunca se elimina el registro.
export function borrarLote(db, dispositivo, id) {
  return transaccion(db, [TABLAS.lotes, TABLAS.operaciones], 'readwrite', async (tx) => {
    const almacen = tx.objectStore(TABLAS.lotes);
    const actual = await peticion(almacen.get(id));
    if (!actual || !activo(actual)) return actual ?? null;
    const lote = { ...actual, borrado: true, actualizado: ahora() };
    almacen.put(lote);
    tx.objectStore(TABLAS.operaciones).put(nuevaOperacion({
      dispositivo, tipo: 'borrar', entidad: 'lote', entidad_id: id, cambio: { borrado: true },
    }));
    return lote;
  });
}

// Borra un producto y sus lotes activos, cada uno con su operación.
export function borrarProducto(db, dispositivo, id) {
  return transaccion(db, [TABLAS.productos, TABLAS.lotes, TABLAS.operaciones], 'readwrite', async (tx) => {
    const productos = tx.objectStore(TABLAS.productos);
    const lotes = tx.objectStore(TABLAS.lotes);
    const operaciones = tx.objectStore(TABLAS.operaciones);
    const producto = await peticion(productos.get(id));
    if (!producto || !activo(producto)) return null;
    productos.put({ ...producto, borrado: true, actualizado: ahora() });
    operaciones.put(nuevaOperacion({ dispositivo, tipo: 'borrar', entidad: 'producto', entidad_id: id, cambio: { borrado: true } }));
    const suyos = (await peticion(lotes.getAll())).filter((l) => activo(l) && l.producto_id === id);
    for (const lote of suyos) {
      lotes.put({ ...lote, borrado: true, actualizado: ahora() });
      operaciones.put(nuevaOperacion({ dispositivo, tipo: 'borrar', entidad: 'lote', entidad_id: lote.id, cambio: { borrado: true } }));
    }
    return { producto, lotes: suyos.length };
  });
}

// Configuración: valores por clave. No genera operaciones (la sincronización de ajustes
// se decide en la fase 4).
// Guarda un ajuste con su fecha, para que la sincronización gane el más reciente.
export function guardarConfiguracion(db, clave, valor) {
  return transaccion(db, [TABLAS.configuracion], 'readwrite', (tx) => {
    tx.objectStore(TABLAS.configuracion).put({ clave, valor, actualizado: ahora() });
    return valor;
  });
}

// Las fotos se guardan como bytes y no como Blob: WebKit (Safari) no puede guardar en
// IndexedDB un Blob creado con canvas.toBlob ("Error preparing Blob/File data").
export async function guardarFoto(db, blob) {
  const id = nuevoId();
  const bytes = await blob.arrayBuffer();
  return transaccion(db, [TABLAS.fotos], 'readwrite', (tx) => {
    tx.objectStore(TABLAS.fotos).put({ id, bytes, tipo: blob.type || 'image/jpeg', creada: ahora() });
    return id;
  });
}

// Un lote puede llevar el id local de la foto o, tras subirla a Drive, el id de Drive.
export async function leerFoto(db, id) {
  if (!id) return null;
  const foto = await transaccion(db, [TABLAS.fotos], 'readonly', async (tx) => {
    const almacen = tx.objectStore(TABLAS.fotos);
    const directa = await peticion(almacen.get(id));
    if (directa) return directa;
    return (await peticion(almacen.getAll())).find((f) => f.drive_id === id) ?? null;
  });
  if (!foto) return null;
  return { id: foto.id, creada: foto.creada, blob: new Blob([foto.bytes], { type: foto.tipo }) };
}

// Lee todo lo que necesita la interfaz de una vez.
export function cargarTodo(db) {
  return transaccion(db, Object.values(TABLAS), 'readonly', async (tx) => ({
    productos: await peticion(tx.objectStore(TABLAS.productos).getAll()),
    lotes: await peticion(tx.objectStore(TABLAS.lotes).getAll()),
    configuracion: await peticion(tx.objectStore(TABLAS.configuracion).getAll()),
    operaciones: await peticion(tx.objectStore(TABLAS.operaciones).getAll()),
  }));
}

// Ajustes locales del móvil (no se exportan ni se sincronizan), como la URL y el token.
export function guardarMeta(db, clave, valor) {
  return transaccion(db, [TABLAS.meta], 'readwrite', (tx) => {
    tx.objectStore(TABLAS.meta).put({ clave, valor });
    return valor;
  });
}

export function leerMeta(db, clave) {
  return transaccion(db, [TABLAS.meta], 'readonly', async (tx) => (await peticion(tx.objectStore(TABLAS.meta).get(clave)))?.valor ?? '');
}
