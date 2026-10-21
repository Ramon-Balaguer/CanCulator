import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { build, WITH_VERSION } from '../../scripts/construir.mjs';
import { VERSION_MARKER } from '../../js/logica/version.js';

test('construir copia la app e inyecta el hash en sw.js y version.js', async () => {
  const hash = 'deadbeefcafe0123456789abcdef0123456789ab';
  const destination = await build(hash);
  for (const uploadedFile of WITH_VERSION) {
    const text = await readFile(join(destination, uploadedFile), 'utf8');
    assert.ok(text.includes(hash), `${uploadedFile} contiene el hash`);
    assert.ok(!text.includes(VERSION_MARKER), `${uploadedFile} no conserva el marcador`);
  }
  const sw = await readFile(join(destination, 'sw.js'), 'utf8');
  assert.match(sw, /const CACHE = `\$\{PREFIX\}\$\{VERSION\}`/);
  assert.ok(existsSync(join(destination, 'index.html')));
  assert.ok(!existsSync(join(destination, 'tests')), 'no publica las pruebas');
  assert.ok(!existsSync(join(destination, 'node_modules')), 'no publica node_modules');
  assert.ok(!existsSync(join(destination, 'package.json')), 'no publica package.json');
});

test('todo lo que precarga el service worker existe', async () => {
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  const routes = [...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(routes.length > 0);
  for (const route of routes) {
    assert.ok(existsSync(new URL(`../../${route}`, import.meta.url)), `existe ${route}`);
  }
});

test('todo lo que precarga el service worker se publica', async () => {
  const { PUBLISHED } = await import('../../scripts/construir.mjs');
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  const routes = [...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  for (const route of routes) {
    assert.ok(PUBLISHED.includes(route.split('/')[0]), `se publica ${route}`);
  }
});

test('el service worker precarga todos los ficheros de la app (sin conexión, todo debe estar)', async () => {
  const { readdir } = await import('node:fs/promises');
  const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');
  const list = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
  const precached = new Set([...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  async function walk(dir) {
    const entries = await readdir(new URL(`../../${dir}/`, import.meta.url), { withFileTypes: true });
    const files = await Promise.all(entries.map((e) => (e.isDirectory()
      ? walk(`${dir}/${e.name}`)
      : [`${dir}/${e.name}`])));
    return files.flat();
  }
  const required = [
    ...await walk('js'),
    ...await walk('css'),
    ...(await walk('vendor')).filter((f) => !f.includes('/licencias/')),
    'index.html',
    'prueba-camara.html',
    'manifest.webmanifest',
  ];
  const missing = required.filter((f) => !precached.has(f));
  assert.deepEqual(missing, [], 'ficheros que no se precargan');
});
