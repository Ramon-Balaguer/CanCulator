import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulosCodigo } from '../../js/logica/ean.js';
import { modulosEan13 } from '../fixtures/codigo-barras.js';

test('EAN-13: 95 módulos, con guardas de inicio, centro y fin', () => {
  const m = modulosCodigo('3229820129488');
  assert.equal(m.length, 95);
  assert.ok(m.startsWith('101') && m.endsWith('101'));
  assert.equal(m.slice(45, 50), '01010');
});

test('EAN-13 coincide con el cálculo de referencia de las fixtures', () => {
  assert.equal(modulosCodigo('4006381333931'), modulosEan13('4006381333931'));
});

test('EAN-8: 67 módulos', () => {
  const m = modulosCodigo('96385074');
  assert.equal(m.length, 67);
  assert.ok(m.startsWith('101') && m.endsWith('101'));
});

test('UPC-A (12 dígitos) se dibuja como EAN-13 con un 0 delante', () => {
  assert.equal(modulosCodigo('036000291452'), modulosCodigo('0036000291452'));
  assert.equal(modulosCodigo('036000291452').length, 95);
});

test('rechaza códigos no dibujables: longitud, letras o dígito de control incorrecto', () => {
  assert.throws(() => modulosCodigo('12345'), /no dibujable/);
  assert.throws(() => modulosCodigo('ABC1234567890'), /no dibujable/);
  assert.throws(() => modulosCodigo('3229820129489'), /Dígito de control/);
  assert.throws(() => modulosCodigo(''), /no dibujable/);
});
