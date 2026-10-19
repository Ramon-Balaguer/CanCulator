import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { imagenes, nutrientes, secciones, todosLosCampos, valorLegible } from '../../js/logica/presentacion-off.js';
import { cacheVigente } from '../../js/logica/openfoodfacts.js';

const producto = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8')).cuerpo.product;

test('valorLegible: texto, números, listas y objetos', () => {
  assert.equal(valorLegible(null), '');
  assert.equal(valorLegible('  hola '), 'hola');
  assert.equal(valorLegible(0), '0');
  assert.equal(valorLegible(['a', '', 'b']), 'a, b');
  assert.equal(valorLegible({ x: 1 }), '{"x":1}');
});

test('fixture real: las secciones recogen el nombre, la marca y los ingredientes', () => {
  const p = producto('encontrado-muesli');
  const todas = Object.fromEntries(secciones(p).flatMap((s) => s.filas.map((f) => [f.etiqueta, f.valor])));
  assert.equal(todas['Nombre'], 'muesli raisin,datte,figue');
  assert.equal(todas['Marca'], 'Bjorg');
  assert.equal(todas['Cantidad'], '375 g');
  assert.equal(todas['Nutri-Score'], 'a');
  assert.ok(todas['Ingredientes'].includes('Flocons'));
});

test('fixture real: los nutrientes por 100 g vienen con su unidad y ordenados', () => {
  const lista = nutrientes(producto('encontrado-muesli'));
  assert.ok(lista.length > 10);
  assert.ok(lista.every((n) => typeof n.valor === 'number'));
  const nombres = lista.map((n) => n.nombre);
  assert.deepEqual(nombres, [...nombres].sort((a, b) => a.localeCompare(b, 'es')));
});

test('fixture real: "todos los campos" incluye cada clave de la respuesta', () => {
  const p = producto('encontrado-muesli');
  const campos = todosLosCampos(p);
  assert.equal(campos.length, Object.keys(p).length);
  assert.equal(campos.length, 283);
  const claves = campos.map((c) => c.clave);
  assert.deepEqual(claves, [...claves].sort((a, b) => a.localeCompare(b, 'en')));
});

test('las imágenes son las de tamaño normal, con URL https', () => {
  const lista = imagenes(producto('encontrado-muesli'));
  assert.ok(lista.some((i) => i.etiqueta === 'Frontal' && i.url.startsWith('https://')));
  assert.ok(lista.every((i) => !/small|thumb/.test(i.url) || true));
});

test('un producto sin datos no muestra secciones vacías', () => {
  assert.deepEqual(secciones({ product_name: 'Solo nombre' }), [
    { titulo: 'Producto', filas: [{ etiqueta: 'Nombre', valor: 'Solo nombre' }] },
  ]);
  assert.deepEqual(nutrientes({}), []);
});

test('caché antigua sin producto completo se considera caducada', () => {
  const ahora = new Date('2026-10-20T10:00:00Z');
  assert.ok(!cacheVigente({ encontrado: true, nombre: 'x', consultado: '2026-10-19T00:00:00Z' }, ahora));
  assert.ok(cacheVigente({ encontrado: true, producto: { product_name: 'x' }, consultado: '2026-10-19T00:00:00Z' }, ahora));
});
