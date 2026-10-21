import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDigit, isValidGtin, normalizeCode, codeType } from '../../js/logica/barcode.js';
import { cameraErrorMessage } from '../../js/logica/camera.js';
import { TEST_CODE, modulesEan13 } from '../fixtures/barcode.js';

test('normalizarCodigo quita espacios y guiones', () => {
  assert.equal(normalizeCode(' 400 6381-333931\n'), '4006381333931');
  assert.equal(normalizeCode(null), '');
});

test('digitoControl calcula el dígito GTIN', () => {
  assert.equal(checkDigit('400638133393'), 1);
  assert.equal(checkDigit('9638507'), 4); // EAN-8 96385074
  assert.equal(checkDigit('03600029145'), 2); // UPC-A 036000291452
});

test('tipoCodigo reconoce los tamaños GTIN', () => {
  assert.equal(codeType('4006381333931'), 'EAN-13');
  assert.equal(codeType('96385074'), 'EAN-8');
  assert.equal(codeType('036000291452'), 'UPC-A');
  assert.equal(codeType('10036000291459'), 'GTIN-14');
  assert.equal(codeType('12345'), null);
  assert.equal(codeType('ABC-123'), null);
});

test('esGtinValido comprueba el dígito de control', () => {
  assert.ok(isValidGtin('4006381333931'));
  assert.ok(isValidGtin('96385074'));
  assert.ok(isValidGtin('036000291452'));
  assert.ok(!isValidGtin('4006381333932'));
  assert.ok(!isValidGtin('12345'));
  assert.ok(!isValidGtin(''));
});

test('mensajeErrorCamara traduce los errores habituales', () => {
  assert.match(cameraErrorMessage({ name: 'NotAllowedError' }), /Permiso de cámara denegado/);
  assert.match(cameraErrorMessage({ name: 'NotFoundError' }), /ninguna cámara/);
  assert.match(cameraErrorMessage({ name: 'NotReadableError' }), /ocupada/);
  assert.match(cameraErrorMessage({ name: 'Raro', message: 'algo' }), /algo/);
  assert.match(cameraErrorMessage(undefined), /error desconocido/);
});

test('el código de prueba es válido y su dibujo EAN-13 tiene 95 módulos', () => {
  assert.ok(isValidGtin(TEST_CODE));
  const modules = modulesEan13(TEST_CODE);
  assert.equal(modules.length, 95);
  assert.ok(modules.startsWith('101') && modules.endsWith('101'));
  assert.equal(modules.slice(45, 50), '01010');
});
