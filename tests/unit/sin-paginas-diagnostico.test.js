import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ruta = (relativa) => fileURLToPath(new URL(`../../${relativa}`, import.meta.url));

const PAGINAS_RETIRADAS = [
  'camera-test.html',
  'peer-test.html',
  'prueba-camara.html',
  'js/camera-test.js',
  'js/peer-test.js',
  'tests/e2e/camera.spec.js',
  'tests/e2e/peer-spike.spec.js',
];

test('no quedan páginas ni tests de prueba de cámara o de sala P2P', () => {
  assert.deepEqual(PAGINAS_RETIRADAS.filter((f) => existsSync(ruta(f))), []);
});

test('el menú de ajustes no enlaza a las pruebas de cámara ni de sala', () => {
  const pantallas = readFileSync(ruta('js/ui/screens.js'), 'utf8');
  assert.doesNotMatch(pantallas, /camera-test|peer-test|prueba-camara/);
});
