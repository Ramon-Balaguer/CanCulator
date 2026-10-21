import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stockStatistics } from '../../js/logica/estadisticas.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));

const products = [
  { id: 'p-muesli', nombre: 'Muesli', categoria: 'cereales', codigo_barras: '3229820129488', stock_minimo: 0, borrado: false },
  { id: 'p-coca', nombre: 'Coca-Cola', categoria: 'agua y bebidas', codigo_barras: '5449000000996', stock_minimo: 0, borrado: false },
  { id: 'p-sin-datos', nombre: 'Lentejas', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, borrado: false },
  { id: 'p-vacio', nombre: 'Sin stock', categoria: 'otros', codigo_barras: '', stock_minimo: 0, borrado: false },
];

const lots = [
  { id: 'l1', producto_id: 'p-muesli', cantidad: 2, caducidad: '2027-03-01', borrado: false },
  { id: 'l2', producto_id: 'p-muesli', cantidad: 1, caducidad: '2027-06-01', borrado: false },
  { id: 'l3', producto_id: 'p-coca', cantidad: 3, caducidad: '2027-03-01', borrado: false },
  { id: 'l4', producto_id: 'p-sin-datos', cantidad: 4, caducidad: '2027-03-01', borrado: false },
  { id: 'l5', producto_id: 'p-vacio', cantidad: 0, caducidad: '2027-03-01', borrado: false },
];

const cacheOff = [
  { codigo: '3229820129488', encontrado: true, producto: fixture('encontrado-muesli').cuerpo.product },
  { codigo: '5449000000996', encontrado: true, producto: fixture('encontrado-coca-cola').cuerpo.product },
];

test('cuenta unidades en total y por categoría, sin lotes a cero', () => {
  const e = stockStatistics(products, lots, cacheOff);
  assert.equal(e.totalUnidades, 10);
  const byCat = Object.fromEntries(e.porCategoria.map((c) => [c.categoria, c.unidades]));
  assert.deepEqual(byCat, { cereales: 3, 'agua y bebidas': 3, legumbres: 4 });
  assert.ok(!e.porCategoria.some((c) => c.categoria === 'otros'));
});

test('calorías: muesli 3 ud. a 1320 kcal/bote y Coca-Cola 3 ud. a 139,9 kcal/bote', () => {
  const e = stockStatistics(products, lots, cacheOff);
  assert.equal(e.totalKcal, 3 * 1320 + 3 * 139.9);
  const cereals = e.porCategoria.find((c) => c.categoria === 'cereales');
  assert.equal(cereals.kcal, 3960);
  assert.equal(e.productosConKcal, 2);
});

test('los productos sin datos de energía no suman kcal y se cuentan aparte', () => {
  const e = stockStatistics(products, lots, cacheOff);
  assert.equal(e.productosSinKcal, 1);
  const pulses = e.porCategoria.find((c) => c.categoria === 'legumbres');
  assert.equal(pulses.kcal, 0);
  assert.equal(pulses.productosSinKcal, 1);
});

test('sin stock ni caché, todo a cero', () => {
  const e = stockStatistics([], [], []);
  assert.deepEqual(e, { totalUnidades: 0, totalKcal: 0, productosConKcal: 0, productosSinKcal: 0, porCategoria: [] });
});
