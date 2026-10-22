import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guessCategory, frontImageUrl } from '../../js/logica/off-category.js';
import { DEFAULT_CATEGORIES } from '../../js/logica/settings.js';

const product = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8')).cuerpo.product;

test('categoría: la cola es agua y bebidas y el muesli arroz y cereales', () => {
  assert.equal(guessCategory(product('encontrado-coca-cola'), DEFAULT_CATEGORIES), 'agua y bebidas');
  assert.equal(guessCategory(product('encontrado-muesli'), DEFAULT_CATEGORIES), 'arroz y cereales');
});

test('categoría: otros ejemplos', () => {
  const g = (tags) => guessCategory({ categories_tags: tags }, DEFAULT_CATEGORIES);
  assert.equal(g(['en:seafood', 'en:fishes', 'en:canned-tunas']), 'pescado');
  assert.equal(g(['en:legumes-and-their-products', 'en:canned-chickpeas']), 'legumbres');
  assert.equal(g(['en:snacks', 'en:chocolates']), 'harinas y repostería');
});

test('categoría: carne, pescado y preparados frescos tienen su propia categoría', () => {
  const g = (tags) => guessCategory({ categories_tags: tags }, DEFAULT_CATEGORIES);
  assert.equal(g(['en:meats', 'en:fresh-meats']), 'carne fresca');
  assert.equal(g(['en:fresh-pork']), 'carne fresca');
  assert.equal(g(['en:seafood', 'en:fresh-fishes']), 'pescado fresco');
  assert.equal(g(['en:fresh-seafood']), 'pescado fresco');
  assert.equal(g(['en:meals', 'en:chilled-ready-meals']), 'preparados frescos');
  assert.equal(g(['en:refrigerated-prepared-dishes']), 'preparados frescos');
});

test('categoría: lo congelado, enlatado o sin frescura sigue en la categoría general', () => {
  const g = (tags) => guessCategory({ categories_tags: tags }, DEFAULT_CATEGORIES);
  assert.equal(g(['en:meats', 'en:pork']), 'carne');
  assert.equal(g(['en:seafood', 'en:frozen-fishes']), 'pescado');
  assert.equal(g(['en:canned-tunas']), 'pescado');
  assert.equal(g(['en:meals', 'en:ready-meals']), 'sopas y platos preparados');
  assert.equal(g(['en:fresh-vegetables']), 'verduras y hortalizas');
});

test('categoría: si el usuario no tiene la categoría fresca, cae en la general', () => {
  const g = (tags, available) => guessCategory({ categories_tags: tags }, available);
  assert.equal(g(['en:fresh-meats'], ['carne', 'pescado']), 'carne');
  assert.equal(g(['en:fresh-fishes'], ['carne', 'pescado']), 'pescado');
  assert.equal(g(['en:chilled-ready-meals'], ['sopas y platos preparados']), 'sopas y platos preparados');
});

test('categoría: sin datos o sin la categoría en la lista devuelve vacío', () => {
  assert.equal(guessCategory({}, DEFAULT_CATEGORIES), '');
  assert.equal(guessCategory({ categories_tags: ['en:colas'] }, ['pasta']), '');
});

test('imagen frontal: solo https', () => {
  assert.equal(frontImageUrl(product('encontrado-muesli')).startsWith('https://'), true);
  assert.equal(frontImageUrl({ image_front_url: 'http://x/y.jpg' }), '');
  assert.equal(frontImageUrl({}), '');
});
