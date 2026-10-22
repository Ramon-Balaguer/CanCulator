import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCacheValid, offPhotoId, parseResponse, productUrl } from '../../js/logica/openfoodfacts.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));

test('la URL pide solo nombre y marca, y rechaza códigos mal formados', () => {
  assert.equal(productUrl('3229820129488'), 'https://world.openfoodfacts.org/api/v2/product/3229820129488.json');
  assert.throws(() => productUrl('abc'), /no válido/);
  assert.throws(() => productUrl('1234'), /no válido/);
});

test('la foto de Open Food Facts de un código tiene un id propio en la base de datos', () => {
  assert.equal(offPhotoId('3229820129488'), 'off-3229820129488');
  assert.throws(() => offPhotoId('abc'), /no válido/);
});

test('fixture real: producto encontrado (muesli)', () => {
  const f = fixture('encontrado-muesli');
  assert.equal(f.http, 200);
  const r = parseResponse(f.http, f.cuerpo);
  assert.equal(r.encontrado, true);
  assert.equal(r.nombre, 'muesli raisin,datte,figue');
  assert.equal(r.marca, 'Bjorg');
});

test('fixture real: producto encontrado (Coca-Cola)', () => {
  const f = fixture('encontrado-coca-cola');
  const r = parseResponse(f.http, f.cuerpo);
  assert.equal(r.encontrado, true);
  assert.equal(r.nombre, 'Coca-Cola Original');
  assert.equal(r.marca, 'COCA-COLA SERVICES SA/NV');
  // The full product travels with the result: it is stored in the cache and shown whole.
  assert.equal(r.producto.code, '5449000000996');
  assert.ok(Object.keys(r.producto).length > 300);
});

test('fixture real: no encontrado es un 404 con status 0, no un error', () => {
  const f = fixture('no-encontrado');
  assert.equal(f.http, 404);
  assert.deepEqual(parseResponse(f.http, f.cuerpo), { encontrado: false });
});

test('sin nombre, usa la marca; espacios sobrantes se quitan', () => {
  const r = parseResponse(200, { status: 1, product: { product_name: '  ', brands: ' Mars,  Wrigley ' } });
  assert.equal(r.nombre, 'Mars, Wrigley');
});

test('respuestas inesperadas lanzan error (no se guardan en caché)', () => {
  assert.throws(() => parseResponse(500, {}), /HTTP 500/);
  assert.throws(() => parseResponse(200, { status: 1 }), /HTTP 200/);
  assert.throws(() => parseResponse(200, null), /HTTP 200/);
});

test('caché: un encontrado vale siempre; un no encontrado, una semana', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.ok(isCacheValid({ encontrado: true, producto: { code: 'x' }, consultado: '2020-01-01T00:00:00Z' }, now));
  assert.ok(isCacheValid({ encontrado: false, consultado: '2026-10-14T10:00:00Z' }, now));
  assert.ok(!isCacheValid({ encontrado: false, consultado: '2026-10-12T10:00:00Z' }, now));
  assert.ok(!isCacheValid(undefined, now));
});
