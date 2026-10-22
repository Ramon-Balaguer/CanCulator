// Actions on the inventory. Each one writes the record and its operation in the same
// v2: Open Food Facts cache (phase 3).
import { TABLES, request, transaction } from './db.js';
import { isActive, findSameLot } from '../logica/inventory.js';
import { isISODate } from '../logica/dates.js';
import { t } from '../logica/idioma.js';

export const OPERATION_TYPES = Object.freeze(['crear', 'editar', 'consumir', 'reponer', 'borrar']);

const now = () => new Date().toISOString();

// Without crypto.randomUUID (old browsers) there is no safe way to generate ids: it warns.
export function newId() {
  if (!globalThis.crypto?.randomUUID) throw new Error(t('store.sin_ids'));
  return crypto.randomUUID();
}

export function newOperation({ dispositivo: device, tipo: type, entidad: entity, entidad_id: entityId, cambio: change = {}, fecha: date = now(), id = newId() }) {
  if (!OPERATION_TYPES.includes(type)) throw new Error(t('store.tipo_desconocido', { tipo: type }));
  return { id, dispositivo: device, fecha: date, tipo: type, entidad: entity, entidad_id: entityId, cambio: change };
}

// Reads the device id; if it does not exist, it creates it. It lives in Meta, not in Configuracion,
// stopping it. It is more faithful than context.setOffline(), which in WebKit cuts the requests
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
  if (!name) throw new Error(t('store.nombre_obligatorio'));
  const minimum = Number(data.stock_minimo ?? 0);
  if (!Number.isInteger(minimum) || minimum < 0) throw new Error(t('store.stock_minimo'));
  const cleanData = {
    nombre: name,
    categoria: String(data.categoria ?? 'otros'),
    codigo_barras: String(data.codigo_barras ?? '').trim(),
    stock_minimo: minimum,
  };
  // Product calories: only touched if they come in the data (empty = no data).
  if (data.kcal_100g !== undefined) cleanData.kcal_100g = optionalNumber(data.kcal_100g, t('store.kcal_100g'));
  if (data.peso_bote_g !== undefined) cleanData.peso_bote_g = optionalNumber(data.peso_bote_g, t('store.peso_bote'));
  // Weight (grams) and price (euros) are optional, as the calories: empty = no data.
  if (data.peso_g !== undefined) cleanData.peso_g = optionalNumber(data.peso_g, t('store.peso'));
  if (data.precio !== undefined) cleanData.precio = optionalNumber(data.precio, t('store.precio'));
  // The photo and the notes belong to the product, not to each lot.
  if (data.foto_id !== undefined) cleanData.foto_id = String(data.foto_id ?? '');
  if (data.observaciones !== undefined) cleanData.observaciones = String(data.observaciones ?? '').trim();
  return cleanData;
}

function optionalNumber(value, name) {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(t('store.numero_no_negativo', { nombre: name }));
  return n;
}

function validateLot(data) {
  const quantity = Number(data.cantidad);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error(t('store.cantidad_minima'));
  if (!isISODate(data.caducidad)) throw new Error(t('store.caducidad_formato'));
  if (!data.ubicacion) throw new Error(t('store.elige_ubicacion'));
  return quantity;
}

// Creates a product. If there is already one with that barcode, it returns it.
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
    if (!current) throw new Error(t('store.producto_no_encontrado'));
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

// Stock in. If a lot already exists with the same product, expiry and location,
// service worker do not go through Playwright's interception and would go to the real network.
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
      // There was already a lot with that expiry and location: the units are added and it is reported.
      return { lote: lot, fusionado: true, anterior: same.cantidad, sumadas: quantity };
    }
    const lot = {
      id: newId(),
      producto_id: data.producto_id,
      cantidad: quantity,
      caducidad: data.caducidad,
      ubicacion: data.ubicacion,
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
      },
    }));
    return { lote: lot, fusionado: false };
  });
}

// Consumes or restocks units of a lot: always increments, never a fixed value.
export function adjustLot(db, device, lotId, delta) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error(t('store.cambio_entero'));
  return transaction(db, [TABLES.lotes, TABLES.operaciones], 'readwrite', async (tx) => {
    const objectStore = tx.objectStore(TABLES.lotes);
    const current = await request(objectStore.get(lotId));
    if (!current || !isActive(current)) throw new Error(t('store.lote_no_encontrado'));
    if (current.cantidad + delta < 0) throw new Error(t('store.consumo_excede'));
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
    if (!current || !isActive(current)) throw new Error(t('store.lote_no_encontrado'));
    const fields = {
      caducidad: changes.caducidad ?? current.caducidad,
      ubicacion: changes.ubicacion ?? current.ubicacion,
    };
    if (!isISODate(fields.caducidad)) throw new Error('La caducidad debe tener formato AAAA-MM-DD');
    if (!fields.ubicacion) throw new Error('Elige una ubicación');
    // "quantity" is the final number the person counts (recount), not an adjustment.
    const newQuantity = changes.cantidad === undefined ? current.cantidad : Number(changes.cantidad);
    if (!Number.isInteger(newQuantity) || newQuantity < 0) throw new Error(t('store.cantidad_cero'));
    const change = Object.fromEntries(
      Object.entries(fields).filter(([k, v]) => current[k] !== v),
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
    // The difference travels as an increment (restock or consume), like the rest of the stock changes.
    if (delta !== 0) {
      operations.put(newOperation({
        dispositivo: device, tipo: delta > 0 ? 'reponer' : 'consumir', entidad: 'lote', entidad_id: id, cambio: { cantidad: delta },
      }));
    }
    return lot;
  });
}

// Logical delete: the record is never removed.
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

// Deletes a product and its active lots, each one with its own operation.
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

// Settings: values by key. Each change also generates an operation, so the other phones
// receive it. The date lets the sync keep the most recent one.
export function saveSetting(db, device, key, value) {
  return transaction(db, [TABLES.configuracion, TABLES.operaciones], 'readwrite', (tx) => {
    const date = now();
    tx.objectStore(TABLES.configuracion).put({ clave: key, valor: value, actualizado: date });
    tx.objectStore(TABLES.operaciones).put(newOperation({
      dispositivo: device, tipo: 'editar', entidad: 'configuracion', entidad_id: key, cambio: { valor: value }, fecha: date,
    }));
    return value;
  });
}

// Photos are stored as bytes and not as a Blob: WebKit (Safari) cannot store in
// IndexedDB a Blob created with canvas.toBlob ("Error preparing Blob/File data").
export async function savePhoto(db, blob, id = newId()) {
  const bytes = await blob.arrayBuffer();
  return transaction(db, [TABLES.fotos], 'readwrite', (tx) => {
    tx.objectStore(TABLES.fotos).put({ id, bytes, tipo: blob.type || 'image/jpeg', creada: now() });
    return id;
  });
}

// A lot can carry the local photo id or, after uploading it to Drive, the Drive id.
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

// Reads everything the interface needs at once.
export function loadAll(db) {
  return transaction(db, Object.values(TABLES), 'readonly', async (tx) => ({
    productos: await request(tx.objectStore(TABLES.productos).getAll()),
    lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
    configuracion: await request(tx.objectStore(TABLES.configuracion).getAll()),
    operaciones: await request(tx.objectStore(TABLES.operaciones).getAll()),
    cacheOff: await request(tx.objectStore(TABLES.cacheOff).getAll()),
  }));
}

// Local app settings (not exported or synced), such as the URL and token.
export function saveMeta(db, key, value) {
  return transaction(db, [TABLES.meta], 'readwrite', (tx) => {
    tx.objectStore(TABLES.meta).put({ clave: key, valor: value });
    return value;
  });
}

export function readMeta(db, key) {
  return transaction(db, [TABLES.meta], 'readonly', async (tx) => (await request(tx.objectStore(TABLES.meta).get(key)))?.valor ?? '');
}
