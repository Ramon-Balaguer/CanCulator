// Calculations on products and lots. The stock is not stored: it is the sum of the non-deleted lots.
import { daysBetween } from './dates.js';

export const isActive = (record) => !!record && !record.borrado;

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compareText = (a, b) => collator.compare(a ?? '', b ?? '');

// To search regardless of case, accents or extra spaces.
export function textKey(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function shortId(id) {
  return String(id ?? '').slice(0, 6);
}

export function mapById(records) {
  return new Map(records.map((r) => [r.id, r]));
}

export function lotsOfProduct(productId, lots) {
  return lots.filter((l) => isActive(l) && l.producto_id === productId);
}

export function stockOf(productId, lots) {
  return lotsOfProduct(productId, lots).reduce((sum, l) => sum + l.cantidad, 0);
}

// Ascending expiry order; with the same date, the lot with fewer units first
// (expires first) and, last, the id so the order is stable.
export function compareExpiry(a, b) {
  return (a.caducidad ?? '9999-99-99').localeCompare(b.caducidad ?? '9999-99-99')
    || a.cantidad - b.cantidad
    || a.id.localeCompare(b.id);
}

// Lots that are seen in the app: not deleted, with units and of a product not deleted.
export function visibleLots(lots, products) {
  const byId = mapById(products);
  return lots
    .filter((l) => isActive(l) && l.cantidad > 0 && isActive(byId.get(l.producto_id)))
    .sort(compareExpiry);
}

export function expiryStatus(expiry, today, daysSoon) {
  const days = daysBetween(today, expiry);
  if (days < 0) return 'caducado';
  if (days <= daysSoon) return 'pronto';
  return 'ok';
}

// Lots of a product to consume: the first is the one that expires first (the suggested one).
export function lotsToConsume(productId, lots) {
  return lotsOfProduct(productId, lots)
    .filter((l) => l.cantidad > 0)
    .sort(compareExpiry);
}

// A row per product: total units, next expiry and locations.
// First those that have units, by name; last those at 0.
export function stockSummary(products, lots) {
  const visible = visibleLots(lots, products);
  return products
    .filter(isActive)
    .map((product) => {
      const own = visible.filter((l) => l.producto_id === product.id);
      return {
        producto: product,
        total: own.reduce((sum, l) => sum + l.cantidad, 0),
        proximaCaducidad: own[0]?.caducidad ?? null,
        ubicaciones: [...new Set(own.map((l) => l.ubicacion))],
      };
    })
    .sort((a, b) => (b.total > 0) - (a.total > 0) || compareText(a.producto.nombre, b.producto.nombre));
}

export function filterSummary(summary, { categoria: category = '', ubicacion: location = '' } = {}) {
  return summary.filter((row) =>
    (!category || row.producto.categoria === category)
    && (!location || row.ubicaciones.includes(location)));
}

// Products with stock below their minimum (only if the minimum is greater than 0).
export function toRestock(products, lots) {
  return products
    .filter((p) => isActive(p) && p.stock_minimo > 0)
    .map((product) => {
      const stock = stockOf(product.id, lots);
      return { producto: product, stock, falta: product.stock_minimo - stock };
    })
    .filter((row) => row.falta > 0)
    .sort((a, b) => b.falta - a.falta || compareText(a.producto.nombre, b.producto.nombre));
}

export function findProductByCode(products, code) {
  if (!code) return null;
  return products.find((p) => isActive(p) && p.codigo_barras === code) ?? null;
}

export function findProductByName(products, name) {
  const key = textKey(name);
  if (!key) return null;
  return products.find((p) => isActive(p) && textKey(p.nombre) === key) ?? null;
}

// A lot is "the same" if product, expiry and location match.
export function findSameLot(lots, { producto_id, caducidad: expiry, ubicacion: location }) {
  return lots.find((l) => isActive(l)
    && l.producto_id === producto_id
    && l.caducidad === expiry
    && l.ubicacion === location) ?? null;
}

// Replaces records that have changed by id. Returns a new list.
export function replaceById(records, changed, key = 'id') {
  if (!changed?.length) return records;
  const newItems = new Map(changed.map((r) => [r[key], r]));
  const result = records.map((r) => newItems.get(r[key]) ?? r);
  const existingList = new Set(records.map((r) => r[key]));
  for (const r of changed) if (!existingList.has(r[key])) result.push(r);
  return result;
}
