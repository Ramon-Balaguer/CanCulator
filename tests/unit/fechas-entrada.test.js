import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateInput, parseTypedDate } from '../../js/logica/fechas.js';

test('formatearEntradaFecha pone las barras mientras se escribe', () => {
  assert.equal(formatDateInput('0'), '0');
  assert.equal(formatDateInput('01'), '01');
  assert.equal(formatDateInput('010'), '01/0');
  assert.equal(formatDateInput('01032027'), '01/03/2027');
  assert.equal(formatDateInput('01/03/2027'), '01/03/2027');
  assert.equal(formatDateInput('01/03/20271'), '01/03/2027');
  assert.equal(formatDateInput('2027-03-01'), '2027-03-01');
  assert.equal(formatDateInput(''), '');
});

test('leerFechaEscrita acepta los formatos habituales y devuelve YYYY-MM-DD', () => {
  assert.equal(parseTypedDate('01/03/2027'), '2027-03-01');
  assert.equal(parseTypedDate('01032027'), '2027-03-01');
  assert.equal(parseTypedDate('1/3/27'), '2027-03-01');
  assert.equal(parseTypedDate('1-3-2027'), '2027-03-01');
  assert.equal(parseTypedDate('2027-03-01'), '2027-03-01');
  assert.equal(parseTypedDate(' 29/02/2028 '), '2028-02-29');
});

test('leerFechaEscrita rechaza fechas imposibles o incompletas', () => {
  assert.equal(parseTypedDate('31/02/2027'), null);
  assert.equal(parseTypedDate('29/02/2027'), null);
  assert.equal(parseTypedDate('01/13/2027'), null);
  assert.equal(parseTypedDate('01/03/'), null);
  assert.equal(parseTypedDate('hola'), null);
  assert.equal(parseTypedDate(''), null);
});
