import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectVersion, versionText, VERSION_MARKER } from '../../js/logica/version.js';

test('inyectarVersion sustituye todas las apariciones del marcador', () => {
  const text = `const A = '${VERSION_MARKER}'; const B = 'x-${VERSION_MARKER}';`;
  assert.equal(injectVersion(text, 'abc1234'), "const A = 'abc1234'; const B = 'x-abc1234';");
});

test('inyectarVersion rechaza hashes no válidos', () => {
  for (const hash of ['', 'xyz', 'ABC1234', 'abc', "abc1234'; alert(1)"]) {
    assert.throws(() => injectVersion(VERSION_MARKER, hash), /no válido/);
  }
});

test('inyectarVersion falla si no hay marcador', () => {
  assert.throws(() => injectVersion('sin marcador', 'abc1234'), /marcador/);
});

test('textoVersion muestra el hash corto o "desarrollo"', () => {
  assert.equal(versionText(VERSION_MARKER), 'desarrollo');
  assert.equal(versionText(''), 'desarrollo');
  assert.equal(versionText('0123456789abcdef'), '0123456');
});
