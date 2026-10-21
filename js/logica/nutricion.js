// Calorías a partir de los datos de Open Food Facts guardados en caché. Sin acceso a red.
// Solo se calcula cuando la API tiene el valor por 100 g o ml y el peso/volumen del envase.
// Los ml se tratan como g (densidad ~1), que es una aproximación para bebidas y líquidos.

const UNIDADES_VALIDAS = ['g', 'ml'];

// Calorías de un bote entero, o null si no se puede calcular con los datos disponibles.
export function kcalPorBote(producto) {
  const kcal100 = producto?.nutriments?.['energy-kcal_100g'];
  const cantidad = Number(producto?.product_quantity);
  const unidad = String(producto?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(cantidad > 0) || !UNIDADES_VALIDAS.includes(unidad)) return null;
  return Math.round((kcal100 * cantidad) / 100 * 10) / 10;
}

// Calorías de varias unidades del mismo producto.
export function kcalDeUnidades(producto, unidades) {
  const porBote = kcalPorBote(producto);
  return porBote === null ? null : Math.round(porBote * unidades * 10) / 10;
}

const tieneValor = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// Calorías de un bote a partir de los datos guardados en el producto (kcal_100g, peso_bote_g).
export function kcalPorBoteGuardado(producto) {
  if (!tieneValor(producto?.kcal_100g) || !tieneValor(producto?.peso_bote_g)) return null;
  const peso = Number(producto.peso_bote_g);
  if (!(peso > 0)) return null;
  return Math.round((Number(producto.kcal_100g) * peso) / 100 * 10) / 10;
}

// Datos a guardar en el producto a partir de Open Food Facts. Vacío si no hay energía utilizable.
export function datosNutricionDesdeOFF(producto) {
  const kcal100 = producto?.nutriments?.['energy-kcal_100g'];
  const peso = Number(producto?.product_quantity);
  const unidad = String(producto?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(peso > 0) || !UNIDADES_VALIDAS.includes(unidad)) return {};
  return { kcal_100g: kcal100, peso_bote_g: peso };
}

// Calorías de unas unidades: primero el dato guardado en el producto; si no hay, la caché de OFF.
export function kcalDeUnidadesDelProducto(producto, offProducto, unidades) {
  const porBote = kcalPorBoteGuardado(producto) ?? kcalPorBote(offProducto);
  return porBote === null ? null : Math.round(porBote * unidades * 10) / 10;
}
