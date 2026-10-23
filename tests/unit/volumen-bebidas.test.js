import { test } from 'node:test';
import assert from 'node:assert/strict';
import { volumenDesdeOFF } from '../../js/logica/openfoodfacts.js';
import { usaVolumen } from '../../js/logica/settings.js';

test('el volumen en ml sale de la cantidad de Open Food Facts, pase en ml, cl o l', () => {
  assert.equal(volumenDesdeOFF({ quantity: '330 ml' }), 330);
  assert.equal(volumenDesdeOFF({ quantity: '33 cl' }), 330);
  assert.equal(volumenDesdeOFF({ quantity: '1,5 l' }), 1500);
});

test('sin cantidad escrita, usa product_quantity; si no hay ninguno, null', () => {
  assert.equal(volumenDesdeOFF({ product_quantity: 500 }), 500);
  assert.equal(volumenDesdeOFF({ quantity: '' }), null);
  assert.equal(volumenDesdeOFF({}), null);
  assert.equal(volumenDesdeOFF(undefined), null);
});

test('aguas, bebidas, tomate y salsas y aceites usan volumen en ml en vez de peso', () => {
  assert.equal(usaVolumen('agua y bebidas'), true);
  assert.equal(usaVolumen('tomate y salsas'), true);
  assert.equal(usaVolumen('aceites y condimentos'), true);
  assert.equal(usaVolumen('pasta'), false);
  assert.equal(usaVolumen(''), false);
});
