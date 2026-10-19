import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { construir, CON_VERSION } from '../../scripts/construir.mjs';
import { MARCADOR_VERSION } from '../../js/logica/version.js';

test('construir copia la app e inyecta el hash en sw.js y version.js', async () => {
  const hash = 'deadbeefcafe0123456789abcdef0123456789ab';
  const destino = await construir(hash);
  for (const fichero of CON_VERSION) {
    const texto = await readFile(join(destino, fichero), 'utf8');
    assert.ok(texto.includes(hash), `${fichero} contiene el hash`);
    assert.ok(!texto.includes(MARCADOR_VERSION), `${fichero} no conserva el marcador`);
  }
  const sw = await readFile(join(destino, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = `\$\{PREFIJO\}\$\{VERSION\}`/);
  assert.ok(existsSync(join(destino, 'index.html')));
  assert.ok(!existsSync(join(destino, 'tests')), 'no publica las pruebas');
  assert.ok(!existsSync(join(destino, 'node_modules')), 'no publica node_modules');
  assert.ok(!existsSync(join(destino, 'package.json')), 'no publica package.json');
});

test('todo lo que precarga el service worker existe', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const lista = sw.match(/const PRECARGA = \[([\s\S]*?)\];/)[1];
  const rutas = [...lista.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(rutas.length > 0);
  for (const ruta of rutas) {
    assert.ok(existsSync(new URL(`../../${ruta}`, import.meta.url)), `existe ${ruta}`);
  }
});

test('todo lo que precarga el service worker se publica', async () => {
  const { PUBLICADOS } = await import('../../scripts/construir.mjs');
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const lista = sw.match(/const PRECARGA = \[([\s\S]*?)\];/)[1];
  const rutas = [...lista.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  for (const ruta of rutas) {
    assert.ok(PUBLICADOS.includes(ruta.split('/')[0]), `se publica ${ruta}`);
  }
});
