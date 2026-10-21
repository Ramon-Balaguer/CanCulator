import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { datosNutricionDesdeOFF, kcalDeUnidadesDelProducto, kcalPorBoteGuardado } from '../../js/logica/nutricion.js';

const muesli = JSON.parse(readFileSync(new URL('../fixtures/off/encontrado-muesli.json', import.meta.url), 'utf8')).cuerpo.product;

test('kcal por bote desde los datos guardados en el producto', () => {
  assert.equal(kcalPorBoteGuardado({ kcal_100g: 352, peso_bote_g: 375 }), 1320);
  assert.equal(kcalPorBoteGuardado({ kcal_100g: '42.4', peso_bote_g: '330' }), 139.9);
  assert.equal(kcalPorBoteGuardado({ kcal_100g: '', peso_bote_g: 330 }), null);
  assert.equal(kcalPorBoteGuardado({ kcal_100g: 42, peso_bote_g: 0 }), null);
  assert.equal(kcalPorBoteGuardado({}), null);
});

test('datos de nutrición a guardar desde Open Food Facts (muesli real)', () => {
  assert.deepEqual(datosNutricionDesdeOFF(muesli), { kcal_100g: 352, peso_bote_g: 375 });
  assert.deepEqual(datosNutricionDesdeOFF({ nutriments: {} }), {});
});

test('las kcal guardadas tienen prioridad sobre la caché de OFF', () => {
  const guardado = { kcal_100g: 100, peso_bote_g: 200 };
  assert.equal(kcalDeUnidadesDelProducto(guardado, muesli, 2), 400);
  assert.equal(kcalDeUnidadesDelProducto({}, muesli, 2), 2640);
  assert.equal(kcalDeUnidadesDelProducto({}, undefined, 2), null);
});
