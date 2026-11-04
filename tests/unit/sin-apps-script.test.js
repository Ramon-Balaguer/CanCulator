import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// El proyecto no usa Apps Script ni clasp en ningún sitio. Este test falla si vuelve alguna referencia.
const PATRON = /apps.?script|Code\.gs|script\.google|\/exec\b|clasp/i;
const ESTE_ARCHIVO = 'tests/unit/sin-apps-script.test.js';

test('no queda ninguna referencia a Apps Script en los archivos del repositorio', () => {
  const archivos = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && f !== ESTE_ARCHIVO);
  // docs/ puede nombrar Apps Script: es el registro histórico de por qué se eliminó (ADR 0005).
  const con = archivos
    .filter((f) => !f.startsWith('docs/'))
    .filter((f) => PATRON.test(readFileSync(f, 'utf8')));
  assert.deepEqual(con, []);
});
