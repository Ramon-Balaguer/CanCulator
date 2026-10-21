// Estadísticas del stock: unidades y calorías, en total y por categoría. Sin DOM ni red.
import { activo, lotesVisibles } from './inventario.js';
import { kcalDeUnidadesDelProducto } from './nutricion.js';

const redondear1 = (n) => Math.round(n * 10) / 10;

// productos: todos; lotes: todos; cacheOff: entradas de la caché de Open Food Facts.
// Las calorías solo cuentan si el producto tiene datos de energía; si no, se cuenta aparte.
export function estadisticasStock(productos, lotes, cacheOff = []) {
  const visibles = lotesVisibles(lotes, productos);
  const offPorCodigo = new Map(
    cacheOff.filter((e) => e.encontrado && e.producto).map((e) => [e.codigo, e.producto]),
  );

  const categorias = new Map();
  let totalUnidades = 0;
  let totalKcal = 0;
  let productosConKcal = 0;
  let productosSinKcal = 0;

  for (const producto of productos.filter(activo)) {
    const unidades = visibles
      .filter((l) => l.producto_id === producto.id)
      .reduce((suma, l) => suma + l.cantidad, 0);
    if (unidades === 0) continue;

    const kcal = kcalDeUnidadesDelProducto(producto, offPorCodigo.get(producto.codigo_barras), unidades);
    const categoria = producto.categoria || 'otros';
    if (!categorias.has(categoria)) {
      categorias.set(categoria, { categoria, unidades: 0, kcal: 0, productosSinKcal: 0 });
    }
    const c = categorias.get(categoria);

    totalUnidades += unidades;
    c.unidades += unidades;
    if (kcal === null) {
      productosSinKcal++;
      c.productosSinKcal++;
    } else {
      productosConKcal++;
      totalKcal += kcal;
      c.kcal += kcal;
    }
  }

  const porCategoria = [...categorias.values()]
    .map((c) => ({ ...c, kcal: redondear1(c.kcal) }))
    .sort((a, b) => b.unidades - a.unidades || a.categoria.localeCompare(b.categoria, 'es'));

  return {
    totalUnidades,
    totalKcal: redondear1(totalKcal),
    productosConKcal,
    productosSinKcal,
    porCategoria,
  };
}
