import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describirCaducidad, duracionLegible } from '../../js/logica/fechas.js';

test('duracionLegible usa días, meses y años según la cantidad', () => {
  assert.equal(duracionLegible(1), '1 día');
  assert.equal(duracionLegible(23), '23 días');
  assert.equal(duracionLegible(31), '1 mes y 1 día');
  assert.equal(duracionLegible(60), '2 meses');
  assert.equal(duracionLegible(365), '1 año');
  assert.equal(duracionLegible(753), '2 años y 23 días');
  assert.equal(duracionLegible(-400), '1 año y 1 mes');
});

test('describirCaducidad con años y meses', () => {
  assert.equal(describirCaducidad(753), 'Caduca en 2 años y 23 días');
  assert.equal(describirCaducidad(-5), 'Caducado hace 5 días');
  assert.equal(describirCaducidad(-100), 'Caducado hace 3 meses y 10 días');
  assert.equal(describirCaducidad(0), 'Caduca hoy');
  assert.equal(describirCaducidad(-1), 'Caducó ayer');
});
