import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digitoControl, esGtinValido, normalizarCodigo, tipoCodigo } from '../../js/logica/codigo-barras.js';
import { mensajeErrorCamara } from '../../js/logica/camara.js';
import { CODIGO_PRUEBA, modulosEan13 } from '../fixtures/codigo-barras.js';

test('normalizarCodigo quita espacios y guiones', () => {
  assert.equal(normalizarCodigo(' 400 6381-333931\n'), '4006381333931');
  assert.equal(normalizarCodigo(null), '');
});

test('digitoControl calcula el dígito GTIN', () => {
  assert.equal(digitoControl('400638133393'), 1);
  assert.equal(digitoControl('9638507'), 4); // EAN-8 96385074
  assert.equal(digitoControl('03600029145'), 2); // UPC-A 036000291452
});

test('tipoCodigo reconoce los tamaños GTIN', () => {
  assert.equal(tipoCodigo('4006381333931'), 'EAN-13');
  assert.equal(tipoCodigo('96385074'), 'EAN-8');
  assert.equal(tipoCodigo('036000291452'), 'UPC-A');
  assert.equal(tipoCodigo('10036000291459'), 'GTIN-14');
  assert.equal(tipoCodigo('12345'), null);
  assert.equal(tipoCodigo('ABC-123'), null);
});

test('esGtinValido comprueba el dígito de control', () => {
  assert.ok(esGtinValido('4006381333931'));
  assert.ok(esGtinValido('96385074'));
  assert.ok(esGtinValido('036000291452'));
  assert.ok(!esGtinValido('4006381333932'));
  assert.ok(!esGtinValido('12345'));
  assert.ok(!esGtinValido(''));
});

test('mensajeErrorCamara traduce los errores habituales', () => {
  assert.match(mensajeErrorCamara({ name: 'NotAllowedError' }), /Permiso de cámara denegado/);
  assert.match(mensajeErrorCamara({ name: 'NotFoundError' }), /ninguna cámara/);
  assert.match(mensajeErrorCamara({ name: 'NotReadableError' }), /ocupada/);
  assert.match(mensajeErrorCamara({ name: 'Raro', message: 'algo' }), /algo/);
  assert.match(mensajeErrorCamara(undefined), /error desconocido/);
});

test('el código de prueba es válido y su dibujo EAN-13 tiene 95 módulos', () => {
  assert.ok(esGtinValido(CODIGO_PRUEBA));
  const modulos = modulosEan13(CODIGO_PRUEBA);
  assert.equal(modulos.length, 95);
  assert.ok(modulos.startsWith('101') && modulos.endsWith('101'));
  assert.equal(modulos.slice(45, 50), '01010');
});
