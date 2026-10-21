// Stock statistics: units and calories, in total and by category. No DOM or network.
import { isActive, visibleLots } from './inventory.js';
import { kcalForUnitsOfProduct } from './nutrition.js';

const round1 = (n) => Math.round(n * 10) / 10;

// rgb: width * height * 3 bytes, row by row.
// Calories only count if the product has energy data; otherwise it is counted separately.
export function stockStatistics(products, lots, cacheOff = []) {
  const visible = visibleLots(lots, products);
  const offByCode = new Map(
    cacheOff.filter((e) => e.encontrado && e.producto).map((e) => [e.codigo, e.producto]),
  );

  const categories = new Map();
  let totalUnits = 0;
  let totalKcal = 0;
  let productsWithKcal = 0;
  let productsWithoutKcal = 0;

  for (const product of products.filter(isActive)) {
    const units = visible
      .filter((l) => l.producto_id === product.id)
      .reduce((sum, l) => sum + l.cantidad, 0);
    if (units === 0) continue;

    const kcal = kcalForUnitsOfProduct(product, offByCode.get(product.codigo_barras), units);
    const category = product.categoria || 'otros';
    if (!categories.has(category)) {
      categories.set(category, { categoria: category, unidades: 0, kcal: 0, productosSinKcal: 0 });
    }
    const c = categories.get(category);

    totalUnits += units;
    c.unidades += units;
    if (kcal === null) {
      productsWithoutKcal++;
      c.productosSinKcal++;
    } else {
      productsWithKcal++;
      totalKcal += kcal;
      c.kcal += kcal;
    }
  }

  const byCategory = [...categories.values()]
    .map((c) => ({ ...c, kcal: round1(c.kcal) }))
    .sort((a, b) => b.unidades - a.unidades || a.categoria.localeCompare(b.categoria, 'es'));

  return {
    totalUnidades: totalUnits,
    totalKcal: round1(totalKcal),
    productosConKcal: productsWithKcal,
    productosSinKcal: productsWithoutKcal,
    porCategoria: byCategory,
  };
}
