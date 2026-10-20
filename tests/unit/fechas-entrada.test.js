import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearEntradaFecha, leerFechaEscrita } from '../../js/logica/fechas.js';

test('formatearEntradaFecha pone las barras mientras se escribe', () => {
  assert.equal(formatearEntradaFecha('0'), '0');
  assert.equal(formatearEntradaFecha('01'), '01');
  assert.equal(formatearEntradaFecha('010'), '01/0');
  assert.equal(formatearEntradaFecha('01032027'), '01/03/2027');
  assert.equal(formatearEntradaFecha('01/03/2027'), '01/03/2027');
  assert.equal(formatearEntradaFecha('01/03/20271'), '01/03/2027');
  assert.equal(formatearEntradaFecha('2027-03-01'), '2027-03-01');
  assert.equal(formatearEntradaFecha(''), '');
});

test('leerFechaEscrita acepta los formatos habituales y devuelve YYYY-MM-DD', () => {
  assert.equal(leerFechaEscrita('01/03/2027'), '2027-03-01');
  assert.equal(leerFechaEscrita('01032027'), '2027-03-01');
  assert.equal(leerFechaEscrita('1/3/27'), '2027-03-01');
  assert.equal(leerFechaEscrita('1-3-2027'), '2027-03-01');
  assert.equal(leerFechaEscrita('2027-03-01'), '2027-03-01');
  assert.equal(leerFechaEscrita(' 29/02/2028 '), '2028-02-29');
});

test('leerFechaEscrita rechaza fechas imposibles o incompletas', () => {
  assert.equal(leerFechaEscrita('31/02/2027'), null);
  assert.equal(leerFechaEscrita('29/02/2027'), null);
  assert.equal(leerFechaEscrita('01/13/2027'), null);
  assert.equal(leerFechaEscrita('01/03/'), null);
  assert.equal(leerFechaEscrita('hola'), null);
  assert.equal(leerFechaEscrita(''), null);
});
