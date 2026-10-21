// Acciones sobre el inventario. Cada una escribe el registro y su operación en la misma
// transacción, así nunca queda un cambio sin su entrada en la cola de sincronización.
import { TABLES, request, transaction } from './db.js';
import { isActive, findSameLot } from '../logica/inventario.js';
import { isISODate } from '../logica/fechas.js';

export const OPERATION_TYPES = Object.freeze(['crear', 'editar', 'consumir', 'reponer', 'borrar']);

const now = () => new Date().toISOString();

// Sin crypto.randomUUID (navegadores antiguos) no hay forma segura de generar ids: se avisa.
export function newId() {
  if (!globalThis.crypto?.randomUUID) throw new Error('Este navegador no puede generar identificadores');
  return crypto.randomUUID();
}

export function newOperation({ dispositivo: device, tipo: type, entidad: entity, entidad_id: entityId, cambio: change = {}, fecha: date = now(), id = newId() }) {
  if (!OPERATION_TYPES.includes(type)) throw new Error(`Tipo de operación desconocido: ${type}`);
  return { id, dispositivo: device, fecha: date, tipo: type, entidad: entity, entidad_id: entityId, cambio: change };
}

// Lee el id del dispositivo; si no existe, lo crea. Vive en Meta, no en Configuracion,
// para que no viaje en las copias JSON ni en la sincronización.
export async function deviceId(db) {
  return transaction(db, [TABLES.meta], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.meta);
    const current = await request(objectStore.get('dispositivo_id'));
    if (current?.valor) return current.valor;
    const value = newId();
    objectStore.put({ clave: 'dispositivo_id', valor: value });
    return value;
  });
}

function validateProduct(data) {
  const name = String(data.nombre ?? '').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('El producto necesita un nombre');
  const minimum = Number(data.stock_minimo ?? 0);
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error('El stock mínimo debe ser un entero de 0 o más');
  const cleanData = {
    nombre: name,
    categoria: String(data.categoria ?? 'otros'),
    codigo_barras: String(data.codigo_barras ?? '').trim(),
    stock_minimo: minimum,
  };
  // Calorías del producto: solo se tocan si vienen en los datos (vacío = sin dato).
  if (data.kcal_100g !== undefined) cleanData.kcal_100g = optionalNumber(data.kcal_100g, 'Calorías por 100 g');
  if (data.peso_bote_g !== undefined) cleanData.peso_bote_g = optionalNumber(data.peso_bote_g, 'Peso del bote');
  return cleanData;
}

function optionalNumber(value, name) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${name} debe ser un número de 0 o más`);
  return n;
}

function validateLot(data) {
  const quantity = Number(data.cantidad);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un entero de 1 o más');
  if (!isISODate(data.caducidad)) throw new Error('La caducidad debe tener formato AAAA-MM-DD');
  if (!data.ubicacion) throw new Error('Elige una ubicación');
  return quantity;
}

// Crea un producto. Si ya hay uno con ese código de barras, devuelve ese.
export function createProduct(db, device, data) {
  const cleanData = validateProduct(data);
  return transaction(db, [TABLES.productos, TABLES.operaciones], 'readwrite', async (tx) => {
    const products = await request(tx.objectStore(TABLES.productos).getAll());
    if (cleanData.codigo_barras) {
      const same = products.find((p) => isActive(p) && p.codigo_barras === cleanData.codigo_barras);
      if (same) return same;
    }
    const product = { id: newId(), ...cleanData, actualizado: now(), borrado: false };
    tx.objectStore(TABLES.productos).put(product);
    tx.objectStore(TABLES.operaciones).put(newOperation({
      dispositivo: device, tipo: 'crear', entidad: 'producto', entidad_id: product.id, cambio: { ...cleanData },
    }));
    return product;
  });
}

export function editProduct(db, device, id, changes) {
  return transaction(db, [TABLES.productos, TABLES.operaciones], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.productos);
    const current = await request(objectStore.get(id));
    if (!current) throw new Error('Producto no encontrado');
    const cleanData = validateProduct({ ...current, ...changes });
    const change = Object.fromEntries(Object.entries(cleanData).filter(([k, v]) => current[k] !== v));
    if (Object.keys(change).length === 0) return current;
    const product = { ...current, ...change, actualizado: now() };
    objectStore.put(product);
    tx.objectStore(TABLES.operaciones).put(newOperation({
      dispositivo: device, tipo: 'editar', entidad: 'producto', entidad_id: id, cambio: change,
    }));
    return product;
  });
}

// Alta de unidades. Si ya existe un lote del mismo producto, caducidad y ubicación,
// se suman a ese lote (reposición) en lugar de crear otro.
export function addLot(db, device, data) {
  const quantity = validateLot(data);
  return transaction(db, [TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const lots = await request(tx.objectStore(TABLES.lotes).getAll());
    const operations = tx.objectStore(TABLES.operaciones);
    const same = findSameLot(lots, { producto_id: data.producto_id, caducidad: data.caducidad, ubicacion: data.ubicacion });
    if (same) {
      const lot = { ...same, cantidad: same.cantidad + quantity, actualizado: now() };
      tx.objectStore(TABLES.lotes).put(lot);
      operations.put(newOperation({
        dispositivo: device, tipo: 'reponer', entidad: 'lote', entidad_id: lot.id, cambio: { cantidad: quantity },
      }));
      // Ya había un lote con esa caducidad y ubicación: se suman las unidades y se avisa.
      return { lote: lot, fusionado: true, anterior: same.cantidad, sumadas: quantity };
    }
    const lot = {
      id: newId(),
      producto_id: data.producto_id,
      cantidad: quantity,
      caducidad: data.caducidad,
      ubicacion: data.ubicacion,
      observaciones: String(data.observaciones ?? '').trim(),
      foto_id: data.foto_id ?? '',
      revisar: 'no',
      actualizado: now(),
      borrado: false,
    };
    tx.objectStore(TABLES.lotes).put(lot);
    operations.put(newOperation({
      dispositivo: device, tipo: 'crear', entidad: 'lote', entidad_id: lot.id,
      cambio: {
        producto_id: lot.producto_id,
        cantidad: quantity,
        caducidad: lot.caducidad,
        ubicacion: lot.ubicacion,
        observaciones: lot.observaciones,
        foto_id: lot.foto_id,
      },
    }));
    return { lote: lot, fusionado: false };
  });
}

// Consumir o reponer unidades de un lote: siempre incrementos, nunca un valor fijo.
export function adjustLot(db, device, lotId, delta) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('El cambio debe ser un entero distinto de 0');
  return transaction(db, [TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.lotes);
    const current = await request(objectStore.get(lotId));
    if (!current || !isActive(current)) throw new Error('Lote no encontrado');
    if (current.cantidad + delta < 0) throw new Error('No puedes consumir más unidades de las que hay en el lote');
    const lot = { ...current, cantidad: current.cantidad + delta, actualizado: now() };
    objectStore.put(lot);
    tx.objectStore(TABLES.operaciones).put(newOperation({
      dispositivo: device,
      tipo: delta < 0 ? 'consumir' : 'reponer',
      entidad: 'lote',
      entidad_id: lotId,
      cambio: { cantidad: delta },
    }));
    return lot;
  });
}

export const consume = (db, device, lotId, units = 1) => adjustLot(db, device, lotId, -units);
export const restock = (db, device, lotId, units = 1) => adjustLot(db, device, lotId, units);

export function editLot(db, device, id, changes) {
  return transaction(db, [TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.lotes);
    const current = await request(objectStore.get(id));
    if (!current || !isActive(current)) throw new Error('Lote no encontrado');
    const fields = {
      caducidad: changes.caducidad ?? current.caducidad,
      ubicacion: changes.ubicacion ?? current.ubicacion,
    };
    if (!isISODate(fields.caducidad)) throw new Error('La caducidad debe tener formato AAAA-MM-DD');
    if (!fields.ubicacion) throw new Error('Elige una ubicación');
    // "cantidad" es el número final que cuenta la persona (recuento), no un ajuste.
    const newQuantity = changes.cantidad === undefined ? current.cantidad : Number(changes.cantidad);
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error('La cantidad debe ser un entero de 0 o más');
    const newItem = {
      observaciones: changes.observaciones !== undefined ? String(changes.observaciones).trim() : current.observaciones,
      foto_id: changes.foto_id ?? current.foto_id,
    };
    const change = Object.fromEntries(
      Object.entries({ ...fields, ...newItem }).filter(([k, v]) => current[k] !== v),
    );
    const delta = newQuantity - current.cantidad;
    if (Object.keys(change).length === 0 && delta === 0) return current;
    const lot = { ...current, ...change, cantidad: newQuantity, actualizado: now() };
    objectStore.put(lot);
    const operations = tx.objectStore(TABLES.operaciones);
    if (Object.keys(change).length > 0) {
      operations.put(newOperation({
        dispositivo: device, tipo: 'editar', entidad: 'lote', entidad_id: id, cambio: change,
      }));
    }
    // La diferencia viaja como incremento (reponer o consumir), igual que el resto de cambios de stock.
    if (delta !== 0) {
      operations.put(newOperation({
        dispositivo: device, tipo: delta > 0 ? 'reponer' : 'consumir', entidad: 'lote', entidad_id: id, cambio: { cantidad: delta },
      }));
    }
    return lot;
  });
}

// Borrado lógico: nunca se elimina el registro.
export function removeLot(db, device, id) {
  return transaction(db, [TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.lotes);
    const current = await request(objectStore.get(id));
    if (!current || !isActive(current)) return current ?? null;
    const lot = { ...current, borrado: true, actualizado: now() };
    objectStore.put(lot);
    tx.objectStore(TABLES.operaciones).put(newOperation({
      dispositivo: device, tipo: 'borrar', entidad: 'lote', entidad_id: id, cambio: { borrado: true },
    }));
    return lot;
  });
}

// Borra un producto y sus lotes activos, cada uno con su operación.
export function removeProduct(db, device, id) {
  return transaction(db, [TABLES.productos, TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const products = tx.objectStore(TABLES.productos);
    const lots = tx.objectStore(TABLES.lotes);
    const operations = tx.objectStore(TABLES.operaciones);
    const product = await request(products.get(id));
    if (!product || !isActive(product)) return null;
    products.put({ ...product, borrado: true, actualizado: now() });
    operations.put(newOperation({ dispositivo: device, tipo: 'borrar', entidad: 'producto', entidad_id: id, cambio: { borrado: true } }));
    const own = (await request(lots.getAll())).filter((l) => isActive(l) && l.producto_id === id);
    for (const lot of own) {
      lots.put({ ...lot, borrado: true, actualizado: now() });
      operations.put(newOperation({ dispositivo: device, tipo: 'borrar', entidad: 'lote', entidad_id: lot.id, cambio: { borrado: true } }));
    }
    return { producto: product, lotes: own.length };
  });
}

// Configuración: valores por clave. No genera operaciones (la sincronización de ajustes
// se decide en la fase 4).
// Guarda un ajuste con su fecha, para que la sincronización gane el más reciente.
export function saveSetting(db, key, value) {
  return transaction(db, [TABLES.configuracion], 'readwrite', (tx) => {
    tx.objectStore(TABLES.configuracion).put({ clave: key, valor: value, actualizado: now() });
    return value;
  });
}

// Las fotos se guardan como bytes y no como Blob: WebKit (Safari) no puede guardar en
// IndexedDB un Blob creado con canvas.toBlob ("Error preparing Blob/File data").
export async function savePhoto(db, blob) {
  const id = newId();
  const bytes = await blob.arrayBuffer();
  return transaction(db, [TABLES.fotos], 'readwrite', (tx) => {
    tx.objectStore(TABLES.fotos).put({ id, bytes, tipo: blob.type || 'image/jpeg', creada: now() });
    return id;
  });
}

// Un lote puede llevar el id local de la foto o, tras subirla a Drive, el id de Drive.
export async function readPhoto(db, id) {
  if (!id) return null;
  const photo = await transaction(db, [TABLES.fotos], 'readonly', async (tx) => {
    const objectStore = tx.objectStore(TABLES.fotos);
    const direct = await request(objectStore.get(id));
    if (direct) return direct;
    return (await request(objectStore.getAll())).find((f) => f.drive_id === id) ?? null;
  });
  if (!photo) return null;
  return { id: photo.id, creada: photo.creada, blob: new Blob([photo.bytes], { type: photo.tipo }) };
}

// Lee todo lo que necesita la interfaz de una vez.
export function loadAll(db) {
  return transaction(db, Object.values(TABLES), 'readonly', async (tx) => ({
    productos: await request(tx.objectStore(TABLES.productos).getAll()),
    lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
    configuracion: await request(tx.objectStore(TABLES.configuracion).getAll()),
    operaciones: await request(tx.objectStore(TABLES.operaciones).getAll()),
    cacheOff: await request(tx.objectStore(TABLES.cacheOff).getAll()),
  }));
}

// Ajustes locales del móvil (no se exportan ni se sincronizan), como la URL y el token.
export function saveMeta(db, key, value) {
  return transaction(db, [TABLES.meta], 'readwrite', (tx) => {
    tx.objectStore(TABLES.meta).put({ clave: key, valor: value });
    return value;
  });
}

export function readMeta(db, key) {
  return transaction(db, [TABLES.meta], 'readonly', async (tx) => (await request(tx.objectStore(TABLES.meta).get(key)))?.valor ?? '');
}
