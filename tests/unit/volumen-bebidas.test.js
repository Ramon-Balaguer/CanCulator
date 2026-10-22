import { test } from 'node:test';
import assert from 'node:assert/strict';
import { volumenDesdeOFF } from '../../js/logica/openfoodfacts.js';
import { esBebida } from '../../js/logica/settings.js';

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

test('solo la categoría agua y bebidas usa volumen en ml en vez de peso', () => {
  assert.equal(esBebida('agua y bebidas'), true);
  assert.equal(esBebida('pasta'), false);
  assert.equal(esBebida(''), false);
});
