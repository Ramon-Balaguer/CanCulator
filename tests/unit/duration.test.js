import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeExpiry, readableDuration } from '../../js/logica/dates.js';

test('duracionLegible usa días, meses y años según la cantidad', () => {
  assert.equal(readableDuration(1), '1 día');
  assert.equal(readableDuration(23), '23 días');
  assert.equal(readableDuration(31), '1 mes y 1 día');
  assert.equal(readableDuration(60), '2 meses');
  assert.equal(readableDuration(365), '1 año');
  assert.equal(readableDuration(753), '2 años y 23 días');
  assert.equal(readableDuration(-400), '1 año y 1 mes');
});

test('describirCaducidad con años y meses', () => {
  assert.equal(describeExpiry(753), 'Caduca en 2 años y 23 días');
  assert.equal(describeExpiry(-5), 'Caducado hace 5 días');
  assert.equal(describeExpiry(-100), 'Caducado hace 3 meses y 10 días');
  assert.equal(describeExpiry(0), 'Caduca hoy');
  assert.equal(describeExpiry(-1), 'Caducó ayer');
});
