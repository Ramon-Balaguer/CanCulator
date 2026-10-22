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

// 
// Old entries, without the full product, are considered expired.
export function isCacheValid(entry, now = new Date()) {
  if (!entry?.consultado) return false;
  if (entry.encontrado) return Boolean(entry.producto);
  const age = now.getTime() - new Date(entry.consultado).getTime();
  return age < NOT_FOUND_CACHE_DAYS * 86_400_000;
}
