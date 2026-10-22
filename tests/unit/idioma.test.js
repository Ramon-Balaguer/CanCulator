import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDIOMAS, IDIOMA_POR_DEFECTO, leerIdioma, guardarIdioma, traducir, TEXTOS } from '../../js/logica/idioma.js';

// Almacenamiento falso con la misma forma que localStorage.
function almacenamientoFalso(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
  };
}

test('por defecto la app está en español', () => {
  assert.equal(IDIOMA_POR_DEFECTO, 'es');
  assert.equal(leerIdioma(almacenamientoFalso()), 'es');
});

test('el idioma elegido se guarda y se vuelve a leer tras recargar', () => {
  const almacen = almacenamientoFalso();
  guardarIdioma('en', almacen);
  assert.equal(leerIdioma(almacen), 'en');
});

test('un valor guardado que no es un idioma válido vuelve al español', () => {
  assert.equal(leerIdioma(almacenamientoFalso({ 'cancalculator.idioma': 'fr' })), 'es');
});

test('si el almacenamiento no está disponible, se usa el español sin romper', () => {
  const roto = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  assert.equal(leerIdioma(roto), 'es');
  assert.doesNotThrow(() => guardarIdioma('en', roto));
});

test('traducir devuelve el texto del idioma pedido', () => {
  assert.equal(traducir('es', 'pestana.caducidad'), 'Caducidad');
  assert.equal(traducir('en', 'pestana.caducidad'), 'Expiry');
});

test('traducir sustituye las variables {nombre}', () => {
  assert.equal(traducir('en', 'ajustes.quitada', { valor: 'Pasta' }), 'Removed «Pasta».');
  assert.equal(traducir('es', 'ajustes.quitada', { valor: 'Pasta' }), 'Quitada «Pasta».');
});

test('una clave que no existe se devuelve tal cual, para verla en pantalla', () => {
  assert.equal(traducir('en', 'no.existe'), 'no.existe');
});

test('todos los idiomas tienen las mismas claves', () => {
  const claves = (idioma) => Object.keys(TEXTOS[idioma]).sort();
  assert.deepEqual(IDIOMAS, ['es', 'en']);
  assert.deepEqual(claves('en'), claves('es'));
});
