import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kcalDeUnidades, kcalPorBote } from '../../js/logica/nutricion.js';

const producto = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8')).cuerpo.product;

test('fixture real: muesli 375 g a 352 kcal/100 g → 1320 kcal por bote', () => {
  assert.equal(kcalPorBote(producto('encontrado-muesli')), 1320);
  assert.equal(kcalDeUnidades(producto('encontrado-muesli'), 3), 3960);
});

test('fixture real: Coca-Cola 330 ml a 42,4 kcal/100 ml → 139,9 kcal por bote', () => {
  assert.equal(kcalPorBote(producto('encontrado-coca-cola')), 139.9);
});

test('sin datos suficientes devuelve null, no un cero engañoso', () => {
  assert.equal(kcalPorBote({ nutriments: {}, product_quantity: 100, product_quantity_unit: 'g' }), null);
  assert.equal(kcalPorBote({ nutriments: { 'energy-kcal_100g': 100 } }), null);
  assert.equal(kcalPorBote({ nutriments: { 'energy-kcal_100g': 100 }, product_quantity: 2, product_quantity_unit: 'oz' }), null);
  assert.equal(kcalDeUnidades({}, 2), null);
});
