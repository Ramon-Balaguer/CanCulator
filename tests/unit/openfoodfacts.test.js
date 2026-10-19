import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cacheVigente, interpretarRespuesta, urlProducto, CAMPOS } from '../../js/logica/openfoodfacts.js';

const fixture = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8'));

test('la URL pide solo nombre y marca, y rechaza códigos mal formados', () => {
  assert.equal(urlProducto('3229820129488'), 'https://world.openfoodfacts.org/api/v2/product/3229820129488.json?fields=product_name,brands');
  assert.equal(CAMPOS, 'product_name,brands');
  assert.throws(() => urlProducto('abc'), /no válido/);
  assert.throws(() => urlProducto('1234'), /no válido/);
});

test('fixture real: producto encontrado (muesli)', () => {
  const f = fixture('encontrado-muesli');
  assert.equal(f.http, 200);
  const r = interpretarRespuesta(f.http, f.cuerpo);
  assert.equal(r.encontrado, true);
  assert.equal(r.nombre, 'muesli raisin,datte,figue');
  assert.equal(r.marca, 'Bjorg');
});

test('fixture real: producto encontrado (Coca-Cola)', () => {
  const f = fixture('encontrado-coca-cola');
  const r = interpretarRespuesta(f.http, f.cuerpo);
  assert.deepEqual(r, { encontrado: true, nombre: 'Coca-Cola Original', marca: 'COCA-COLA SERVICES SA/NV' });
});

test('fixture real: no encontrado es un 404 con status 0, no un error', () => {
  const f = fixture('no-encontrado');
  assert.equal(f.http, 404);
  assert.deepEqual(interpretarRespuesta(f.http, f.cuerpo), { encontrado: false });
});

test('sin nombre, usa la marca; espacios sobrantes se quitan', () => {
  const r = interpretarRespuesta(200, { status: 1, product: { product_name: '  ', brands: ' Mars,  Wrigley ' } });
  assert.equal(r.nombre, 'Mars, Wrigley');
});

test('respuestas inesperadas lanzan error (no se guardan en caché)', () => {
  assert.throws(() => interpretarRespuesta(500, {}), /HTTP 500/);
  assert.throws(() => interpretarRespuesta(200, { status: 1 }), /HTTP 200/);
  assert.throws(() => interpretarRespuesta(200, null), /HTTP 200/);
});

test('caché: un encontrado vale siempre; un no encontrado, una semana', () => {
  const ahora = new Date('2026-10-20T10:00:00Z');
  assert.ok(cacheVigente({ encontrado: true, consultado: '2020-01-01T00:00:00Z' }, ahora));
  assert.ok(cacheVigente({ encontrado: false, consultado: '2026-10-14T10:00:00Z' }, ahora));
  assert.ok(!cacheVigente({ encontrado: false, consultado: '2026-10-12T10:00:00Z' }, ahora));
  assert.ok(!cacheVigente(undefined, ahora));
});
