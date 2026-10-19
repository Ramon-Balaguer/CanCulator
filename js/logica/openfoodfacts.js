// Open Food Facts: consulta de nombre por código de barras. Sin acceso a red aquí.
// Comprobado contra la API real (fixtures en tests/fixtures/off/):
//  - producto encontrado: HTTP 200, status 1, product.product_name y product.brands
//  - producto no encontrado: HTTP 404 con status 0 (no es un error de red)

export const URL_BASE = 'https://world.openfoodfacts.org/api/v2/product/';
export const CAMPOS = 'product_name,brands';

// Un "no encontrado" se guarda en caché una semana; uno encontrado, siempre.
export const DIAS_CACHE_NO_ENCONTRADO = 7;

export function urlProducto(codigo) {
  if (!/^\d{8,14}$/.test(codigo)) throw new Error(`Código no válido para Open Food Facts: ${codigo}`);
  return `${URL_BASE}${codigo}.json?fields=${CAMPOS}`;
}

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

// Devuelve { encontrado, nombre, marca }. Lanza error si la respuesta no es una de las conocidas.
export function interpretarRespuesta(http, cuerpo) {
  if (http === 404 && cuerpo?.status === 0) return { encontrado: false };
  if (http === 200 && cuerpo?.status === 0) return { encontrado: false };
  if (http === 200 && cuerpo?.status === 1 && cuerpo.product) {
    const nombre = limpiar(cuerpo.product.product_name);
    const marca = limpiar(cuerpo.product.brands);
    // Sin nombre, la marca es mejor que nada; el usuario lo corrige si hace falta.
    return { encontrado: true, nombre: nombre || marca, marca };
  }
  throw new Error(`Respuesta inesperada de Open Food Facts (HTTP ${http})`);
}

// ¿Sirve todavía una entrada de caché? "ahora" se pasa para poder probarlo.
export function cacheVigente(entrada, ahora = new Date()) {
  if (!entrada?.consultado) return false;
  if (entrada.encontrado) return true;
  const edad = ahora.getTime() - new Date(entrada.consultado).getTime();
  return edad < DIAS_CACHE_NO_ENCONTRADO * 86_400_000;
}
