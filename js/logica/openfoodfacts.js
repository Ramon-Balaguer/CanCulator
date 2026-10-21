// Open Food Facts: consulta de productos por código de barras. Sin acceso a red aquí.
// Comprobado contra la API real (fixtures en tests/fixtures/off/):
//  - producto encontrado: HTTP 200, status 1, y el producto completo en "product"
//  - producto no encontrado: HTTP 404 con status 0 (no es un error de red)
// Se pide el producto completo (sin filtro de campos): la app muestra toda la información.

export const API_BASE = 'https://world.openfoodfacts.org/api/v2/product/';

// Un "no encontrado" se guarda en caché una semana; uno encontrado, siempre.
export const NOT_FOUND_CACHE_DAYS = 7;

export function productUrl(code) {
  if (!/^\d{8,14}$/.test(code)) throw new Error(`Código no válido para Open Food Facts: ${code}`);
  return `${API_BASE}${code}.json`;
}

const cleanText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// Devuelve { encontrado, nombre, marca, producto }. Lanza error si la respuesta no es una de las conocidas.
export function parseResponse(http, body) {
  if (http === 404 && body?.status === 0) return { encontrado: false };
  if (http === 200 && body?.status === 0) return { encontrado: false };
  if (http === 200 && body?.status === 1 && body.product && typeof body.product === 'object') {
    const name = cleanText(body.product.product_name);
    const brand = cleanText(body.product.brands);
    // Sin nombre, la marca es mejor que nada; el usuario lo corrige si hace falta.
    return { encontrado: true, nombre: name || brand, marca: brand, producto: body.product };
  }
  throw new Error(`Respuesta inesperada de Open Food Facts (HTTP ${http})`);
}

// ¿Sirve todavía una entrada de caché? "ahora" se pasa para poder probarlo.
// Las entradas antiguas, sin el producto completo, se consideran caducadas.
export function isCacheValid(entry, now = new Date()) {
  if (!entry?.consultado) return false;
  if (entry.encontrado) return Boolean(entry.producto);
  const age = now.getTime() - new Date(entry.consultado).getTime();
  return age < NOT_FOUND_CACHE_DAYS * 86_400_000;
}
