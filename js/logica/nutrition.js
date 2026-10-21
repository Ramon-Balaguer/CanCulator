// Calories computed from the Open Food Facts data stored in the cache. No network access.
// It is only computed when the API has the value per 100 g or ml and the package weight/volume.
// The ml are treated as g (density ~1), an approximation for drinks and liquids.

const VALID_UNITS = ['g', 'ml'];

// Calories of one whole container, or null if it cannot be computed with the available data.
export function kcalPerContainer(product) {
  const kcal100 = product?.nutriments?.['energy-kcal_100g'];
  const quantity = Number(product?.product_quantity);
  const unit = String(product?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(quantity > 0) || !VALID_UNITS.includes(unit)) return null;
  return Math.round((kcal100 * quantity) / 100 * 10) / 10;
}

// Calories of several units of the same product.
export function kcalForUnits(product, units) {
  const perContainer = kcalPerContainer(product);
  return perContainer === null ? null : Math.round(perContainer * units * 10) / 10;
}

const hasValue = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// Calories of one container from the data stored in the product (kcal_100g, peso_bote_g).
export function storedKcalPerContainer(product) {
  if (!hasValue(product?.kcal_100g) || !hasValue(product?.peso_bote_g)) return null;
  const weight = Number(product.peso_bote_g);
  if (!(weight > 0)) return null;
  return Math.round((Number(product.kcal_100g) * weight) / 100 * 10) / 10;
}

// Data to store in the product from Open Food Facts. Empty if there is no usable energy.
export function nutritionDataFromOFF(product) {
  const kcal100 = product?.nutriments?.['energy-kcal_100g'];
  const weight = Number(product?.product_quantity);
  const unit = String(product?.product_quantity_unit ?? '').toLowerCase();
  if (typeof kcal100 !== 'number' || !(weight > 0) || !VALID_UNITS.includes(unit)) return {};
  return { kcal_100g: kcal100, peso_bote_g: weight };
}

// Calories of several units: first the stored product data; if none, the OFF cache.
export function kcalForUnitsOfProduct(product, offProduct, units) {
  const perContainer = storedKcalPerContainer(product) ?? kcalPerContainer(offProduct);
  return perContainer === null ? null : Math.round(perContainer * units * 10) / 10;
}
