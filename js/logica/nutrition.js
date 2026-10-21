// Calorías a partir de los datos de Open Food Facts guardados en caché. Sin acceso a red.
// Solo se calcula cuando la API tiene el valor por 100 g o ml y el peso/volumen del envase.
// Los ml se tratan como g (densidad ~1), que es una aproximación para bebidas y líquidos.

const VALID_UNITS = ['g', 'ml'];

// Calorías de un bote entero, o null si no se puede calcular con los datos disponibles.
export function kcalPerContainer(product) {
  const kcal100 = product?.nutriments?.['energy-kcal_100g'];
  const quantity = Number(product?.product_quantity);
  const unit = String(product?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(quantity > 0) || !VALID_UNITS.includes(unit)) return null;
  return Math.round((kcal100 * quantity) / 100 * 10) / 10;
}

// Calorías de varias unidades del mismo producto.
export function kcalForUnits(product, units) {
  const perContainer = kcalPerContainer(product);
  return perContainer === null ? null : Math.round(perContainer * units * 10) / 10;
}

const hasValue = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// Calorías de un bote a partir de los datos guardados en el producto (kcal_100g, peso_bote_g).
export function storedKcalPerContainer(product) {
  if (!hasValue(product?.kcal_100g) || !hasValue(product?.peso_bote_g)) return null;
  const weight = Number(product.peso_bote_g);
  if (!(weight > 0)) return null;
  return Math.round((Number(product.kcal_100g) * weight) / 100 * 10) / 10;
}

// Datos a guardar en el producto a partir de Open Food Facts. Vacío si no hay energía utilizable.
export function nutritionDataFromOFF(product) {
  const kcal100 = product?.nutriments?.['energy-kcal_100g'];
  const weight = Number(product?.product_quantity);
  const unit = String(product?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(weight > 0) || !VALID_UNITS.includes(unit)) return {};
  return { kcal_100g: kcal100, peso_bote_g: weight };
}

// Calorías de unas unidades: primero el dato guardado en el producto; si no hay, la caché de OFF.
export function kcalForUnitsOfProduct(product, offProduct, units) {
  const perContainer = storedKcalPerContainer(product) ?? kcalPerContainer(offProduct);
  return perContainer === null ? null : Math.round(perContainer * units * 10) / 10;
}
