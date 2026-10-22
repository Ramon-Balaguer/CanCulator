// Open Food Facts: query of products by barcode. No network access here.
// Checked against the real API (fixtures in tests/fixtures/off/):
//  - product found: HTTP 200, status 1, and the full product in "product"
//  - product not found: HTTP 404 with status 0 (not a network error)
// The full product is requested (without field filter): the app shows all the information.

export const API_BASE = 'https://world.openfoodfacts.org/api/v2/product/';

// A "not found" is cached for a week; a found one, always.
export const NOT_FOUND_CACHE_DAYS = 7;

export function productUrl(code) {
  if (!/^\d{8,14}$/.test(code)) throw new Error(`Código no válido para Open Food Facts: ${code}`);
  return `${API_BASE}${code}.json`;
}

// Id of the product's front photo in the local photo table (the app's own, not the lot's).
export function offPhotoId(code) {
  productUrl(code);
  return `off-${code}`;
}

// Open Prices, the prices project of Open Food Facts: the prices reported for a barcode.
export const PRICES_API_BASE = 'https://prices.openfoodfacts.org/api/v1/prices';

// The most recent price in euros of the code.
export function pricesUrl(code) {
  productUrl(code);
  return `${PRICES_API_BASE}?product_code=${code}&currency=EUR&order_by=-date&size=1`;
}

// Price in euros of the first record, or null if there is none.
export function precioDesdeOpenPrices(body) {
  const price = body?.items?.[0]?.price;
  return typeof price === 'number' && price > 0 ? price : null;
}

const cleanText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// Returns { encontrado, nombre, marca, producto }. Throws if the response is not a known one.
export function parseResponse(http, body) {
  if (http === 404 && body?.status === 0) return { encontrado: false };
  if (http === 200 && body?.status === 0) return { encontrado: false };
  if (http === 200 && body?.status === 1 && body.product && typeof body.product === 'object') {
    const name = cleanText(body.product.product_name);
    const brand = cleanText(body.product.brands);
    // Without a name, the brand is better than nothing; the user corrects it if needed.
    return { encontrado: true, nombre: name || brand, marca: brand, producto: body.product };
  }
  throw new Error(`Respuesta inesperada de Open Food Facts (HTTP ${http})`);
}

// Volume in ml of a drink, from the quantity Open Food Facts gives ("33 cl", "1,5 l"). Null if there is none.
// Without a written quantity, product_quantity (a number, in ml for drinks) is used.
const CANTIDAD_EN_ML = { ml: 1, cl: 10, l: 1000 };
export function volumenDesdeOFF(producto) {
  const escrita = String(producto?.quantity ?? '').match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i);
  if (escrita) return Math.round(Number(escrita[1].replace(',', '.')) * CANTIDAD_EN_ML[escrita[2].toLowerCase()]);
  const numero = Number(producto?.product_quantity);
  return numero > 0 ? numero : null;
}

// 
// Old entries, without the full product, are considered expired.
export function isCacheValid(entry, now = new Date()) {
  if (!entry?.consultado) return false;
  if (entry.encontrado) return Boolean(entry.producto);
  const age = now.getTime() - new Date(entry.consultado).getTime();
  return age < NOT_FOUND_CACHE_DAYS * 86_400_000;
}
