import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatearNumero } from '../../js/logica/formato.js';

test('los miles se separan con punto en español y coma en inglés', () => {
  assert.equal(formatearNumero(4380, 'es'), '4.380');
  assert.equal(formatearNumero(1234567, 'en'), '1,234,567');
  assert.equal(formatearNumero(999, 'es'), '999');
});

test('por defecto no muestra decimales; con decimales pedidos, sí', () => {
  assert.equal(formatearNumero(4379.7, 'es'), '4.380');
  assert.equal(formatearNumero(1.5, 'es', { decimales: 2 }), '1,5');
  assert.equal(formatearNumero(1234.5, 'es', { decimales: 2 }), '1.234,5');
});

test('el mínimo de decimales rellena con ceros (2,40 €)', () => {
  assert.equal(formatearNumero(2.4, 'es', { decimales: 2, minimo: 2 }), '2,40');
  assert.equal(formatearNumero(1234.5, 'en', { decimales: 2, minimo: 2 }), '1,234.50');
});
