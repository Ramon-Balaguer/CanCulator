import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { images, nutrients, sections, allFields, readableValue } from '../../js/logica/presentacion-off.js';
import { isCacheValid } from '../../js/logica/openfoodfacts.js';

const product = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8')).cuerpo.product;

test('valorLegible: texto, números, listas y objetos', () => {
  assert.equal(readableValue(null), '');
  assert.equal(readableValue('  hola '), 'hola');
  assert.equal(readableValue(0), '0');
  assert.equal(readableValue(['a', '', 'b']), 'a, b');
  assert.equal(readableValue({ x: 1 }), '{"x":1}');
});

test('fixture real: las secciones recogen el nombre, la marca y los ingredientes', () => {
  const p = product('encontrado-muesli');
  const all = Object.fromEntries(sections(p).flatMap((s) => s.filas.map((f) => [f.etiqueta, f.valor])));
  assert.equal(all['Nombre'], 'muesli raisin,datte,figue');
  assert.equal(all['Marca'], 'Bjorg');
  assert.equal(all['Cantidad'], '375 g');
  assert.equal(all['Nutri-Score'], 'a');
  assert.ok(all['Ingredientes'].includes('Flocons'));
});

test('fixture real: los nutrientes por 100 g vienen con su unidad y ordenados', () => {
  const list = nutrients(product('encontrado-muesli'));
  assert.ok(list.length > 10);
  assert.ok(list.every((n) => typeof n.valor === 'number'));
  const names = list.map((n) => n.nombre);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'es')));
});

test('fixture real: "todos los campos" incluye cada clave de la respuesta', () => {
  const p = product('encontrado-muesli');
  const fields = allFields(p);
  assert.equal(fields.length, Object.keys(p).length);
  assert.equal(fields.length, 283);
  const keys = fields.map((c) => c.clave);
  assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'en')));
});

test('las imágenes son las de tamaño normal, con URL https', () => {
  const list = images(product('encontrado-muesli'));
  assert.ok(list.some((i) => i.etiqueta === 'Frontal' && i.url.startsWith('https://')));
  assert.ok(list.every((i) => !/small|thumb/.test(i.url) || true));
});

test('un producto sin datos no muestra secciones vacías', () => {
  assert.deepEqual(sections({ product_name: 'Solo nombre' }), [
    { titulo: 'Producto', filas: [{ etiqueta: 'Nombre', valor: 'Solo nombre' }] },
  ]);
  assert.deepEqual(nutrients({}), []);
});

test('caché antigua sin producto completo se considera caducada', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.ok(!isCacheValid({ encontrado: true, nombre: 'x', consultado: '2026-10-19T00:00:00Z' }, now));
  assert.ok(isCacheValid({ encontrado: true, producto: { product_name: 'x' }, consultado: '2026-10-19T00:00:00Z' }, now));
});
