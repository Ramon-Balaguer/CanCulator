import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kcalForUnits, kcalPerContainer } from '../../js/logica/nutrition.js';

const product = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8')).cuerpo.product;

test('fixture real: muesli 375 g a 352 kcal/100 g → 1320 kcal por bote', () => {
  assert.equal(kcalPerContainer(product('encontrado-muesli')), 1320);
  assert.equal(kcalForUnits(product('encontrado-muesli'), 3), 3960);
});

test('fixture real: Coca-Cola 330 ml a 42,4 kcal/100 ml → 139,9 kcal por bote', () => {
  assert.equal(kcalPerContainer(product('encontrado-coca-cola')), 139.9);
});

test('sin datos suficientes devuelve null, no un cero engañoso', () => {
  assert.equal(kcalPerContainer({ nutriments: {}, product_quantity: 100, product_quantity_unit: 'g' }), null);
  assert.equal(kcalPerContainer({ nutriments: { 'energy-kcal_100g': 100 } }), null);
  assert.equal(kcalPerContainer({ nutriments: { 'energy-kcal_100g': 100 }, product_quantity: 2, product_quantity_unit: 'oz' }), null);
  assert.equal(kcalForUnits({}, 2), null);
});
