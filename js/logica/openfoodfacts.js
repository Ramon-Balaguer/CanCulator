// Open Food Facts: consulta de productos por código de barras. Sin acceso a red aquí.
// Comprobado contra la API real (fixtures en tests/fixtures/off/):
//  - producto encontrado: HTTP 200, status 1, y el producto completo en "product"
//  - producto no encontrado: HTTP 404 con status 0 (no es un error de red)
// Se pide el producto completo (sin filtro de campos): la app muestra toda la información.

export const URL_BASE = 'https://world.openfoodfacts.org/api/v2/product/';

// Un "no encontrado" se guarda en caché una semana; uno encontrado, siempre.
export const DIAS_CACHE_NO_ENCONTRADO = 7;

export function urlProducto(codigo) {
  if (!/^\d{8,14}$/.test(codigo)) throw new Error(`Código no válido para Open Food Facts: ${codigo}`);
  return `${URL_BASE}${codigo}.json`;
}

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();

// Devuelve { encontrado, nombre, marca, producto }. Lanza error si la respuesta no es una de las conocidas.
export function interpretarRespuesta(http, cuerpo) {
  if (http === 404 && cuerpo?.status === 0) return { encontrado: false };
  if (http === 200 && cuerpo?.status === 0) return { encontrado: false };
  if (http === 200 && cuerpo?.status === 1 && cuerpo.product && typeof cuerpo.product === 'object') {
    const nombre = limpiar(cuerpo.product.product_name);
    const marca = limpiar(cuerpo.product.brands);
    // Sin nombre, la marca es mejor que nada; el usuario lo corrige si hace falta.
    return { encontrado: true, nombre: nombre || marca, marca, producto: cuerpo.product };
  }
  throw new Error(`Respuesta inesperada de Open Food Facts (HTTP ${http})`);
}

// ¿Sirve todavía una entrada de caché? "ahora" se pasa para poder probarlo.
// Las entradas antiguas, sin el producto completo, se consideran caducadas.
export function cacheVigente(entrada, ahora = new Date()) {
  if (!entrada?.consultado) return false;
  if (entrada.encontrado) return Boolean(entrada.producto);
  const edad = ahora.getTime() - new Date(entrada.consultado).getTime();
  return edad < DIAS_CACHE_NO_ENCONTRADO * 86_400_000;
}
