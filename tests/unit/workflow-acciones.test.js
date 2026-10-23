import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(fileURLToPath(new URL('../../.github/workflows/deploy.yml', import.meta.url)), 'utf8');

const usos = (accion) => [...workflow.matchAll(new RegExp(`uses:\\s*${accion}@v(\\d+)`, 'g'))].map((m) => Number(m[1]));

// Versiones mayores que ejecutan Node 24. Node 20 ya no está disponible en GitHub Actions.
const minimos = {
  'actions/configure-pages': 6,
  'actions/deploy-pages': 5,
  'actions/upload-pages-artifact': 5,
  'actions/upload-artifact': 7,
};

for (const [accion, minimo] of Object.entries(minimos)) {
  test(`${accion} usa al menos la versión ${minimo} (Node 24)`, () => {
    const versiones = usos(accion);
    assert.ok(versiones.length > 0, `${accion} no aparece en deploy.yml`);
    for (const version of versiones) {
      assert.ok(version >= minimo, `${accion}@v${version} sigue en Node 20`);
    }
  });
}
