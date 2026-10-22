import { test } from 'node:test';
import assert from 'node:assert/strict';
import { precioDesdeOpenPrices, pricesUrl } from '../../js/logica/openfoodfacts.js';

test('pricesUrl pide el precio más reciente en euros del código', () => {
  assert.equal(
    pricesUrl('5449000000996'),
    'https://prices.openfoodfacts.org/api/v1/prices?product_code=5449000000996&currency=EUR&order_by=-date&size=1',
  );
  assert.throws(() => pricesUrl('abc'), /no válido/);
});

test('precioDesdeOpenPrices devuelve el precio del registro más reciente', () => {
  assert.equal(precioDesdeOpenPrices({ items: [{ price: 1.99 }] }), 1.99);
});

test('precioDesdeOpenPrices devuelve null si no hay registros o el precio no es válido', () => {
  assert.equal(precioDesdeOpenPrices({ items: [] }), null);
  assert.equal(precioDesdeOpenPrices({ items: [{ price: null }] }), null);
  assert.equal(precioDesdeOpenPrices({ items: [{ price: 0 }] }), null);
  assert.equal(precioDesdeOpenPrices(null), null);
});
