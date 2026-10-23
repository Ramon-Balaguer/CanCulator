import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preguntaDeSuma, esRespuestaCorrecta } from '../../js/logica/reinicio.js';

test('la pregunta suma dos números de un dígito (1 a 9)', () => {
  assert.deepEqual(preguntaDeSuma(() => 0), { a: 1, b: 1, suma: 2 });
  assert.deepEqual(preguntaDeSuma(() => 0.9999), { a: 9, b: 9, suma: 18 });
  const { a, b, suma } = preguntaDeSuma(() => 0.5);
  assert.equal(suma, a + b);
});

test('acepta solo la suma correcta, ignorando los espacios alrededor', () => {
  const pregunta = { a: 3, b: 4, suma: 7 };
  assert.equal(esRespuestaCorrecta(pregunta, '7'), true);
  assert.equal(esRespuestaCorrecta(pregunta, ' 7 '), true);
  assert.equal(esRespuestaCorrecta(pregunta, '8'), false);
  assert.equal(esRespuestaCorrecta(pregunta, ''), false);
  assert.equal(esRespuestaCorrecta(pregunta, '7a'), false);
  assert.equal(esRespuestaCorrecta(pregunta, '34'), false);
});
