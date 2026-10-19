import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inyectarVersion, textoVersion, MARCADOR_VERSION } from '../../js/logica/version.js';

test('inyectarVersion sustituye todas las apariciones del marcador', () => {
  const texto = `const A = '${MARCADOR_VERSION}'; const B = 'x-${MARCADOR_VERSION}';`;
  assert.equal(inyectarVersion(texto, 'abc1234'), "const A = 'abc1234'; const B = 'x-abc1234';");
});

test('inyectarVersion rechaza hashes no válidos', () => {
  for (const hash of ['', 'xyz', 'ABC1234', 'abc', "abc1234'; alert(1)"]) {
    assert.throws(() => inyectarVersion(MARCADOR_VERSION, hash), /no válido/);
  }
});

test('inyectarVersion falla si no hay marcador', () => {
  assert.throws(() => inyectarVersion('sin marcador', 'abc1234'), /marcador/);
});

test('textoVersion muestra el hash corto o "desarrollo"', () => {
  assert.equal(textoVersion(MARCADOR_VERSION), 'desarrollo');
  assert.equal(textoVersion(''), 'desarrollo');
  assert.equal(textoVersion('0123456789abcdef'), '0123456');
});
