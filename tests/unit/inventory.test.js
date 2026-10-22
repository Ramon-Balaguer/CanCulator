import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toRestock,
  findSameLot,
  findProductByCode,
  textKey,
  expiryStatus,
  filterSummary,
  lotsToConsume,
  visibleLots,
  stockSummary,
  stockOf,
  replaceById,
} from '../../js/logica/inventory.js';
import { describeExpiry, daysBetween, isISODate, formatDate, todayInMadrid } from '../../js/logica/dates.js';
import { effectiveSettings, validateValue } from '../../js/logica/settings.js';

const TODAY = '2026-10-20';

const products = [
  { id: 'p-atun', nombre: 'Atún en aceite', categoria: 'pescado', codigo_barras: '8410000000019', stock_minimo: 4, borrado: false },
  { id: 'p-lentejas', nombre: 'Lentejas', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, borrado: false },
  { id: 'p-tomate', nombre: 'Tomate triturado', categoria: 'tomate y salsas', codigo_barras: '', stock_minimo: 2, borrado: false },
  { id: 'p-borrado', nombre: 'Viejo', categoria: 'otros', codigo_barras: '', stock_minimo: 1, borrado: true },
];

const lots = [
  { id: 'l1', producto_id: 'p-atun', cantidad: 3, caducidad: '2027-03-01', ubicacion: 'Despensa', borrado: false },
  { id: 'l2', producto_id: 'p-atun', cantidad: 2, caducidad: '2026-11-15', ubicacion: 'Despensa', borrado: false },
  { id: 'l3', producto_id: 'p-atun', cantidad: 0, caducidad: '2026-10-01', ubicacion: 'Despensa', borrado: false },
  { id: 'l4', producto_id: 'p-lentejas', cantidad: 1, caducidad: '2026-10-19', ubicacion: 'Despensa', borrado: false },
  { id: 'l5', producto_id: 'p-tomate', cantidad: 1, caducidad: '2026-12-31', ubicacion: 'Sótano', borrado: true },
  { id: 'l6', producto_id: 'p-borrado', cantidad: 5, caducidad: '2026-11-01', ubicacion: 'Despensa', borrado: false },
];

test('stock es la suma de lotes no borrados', () => {
  assert.equal(stockOf('p-atun', lots), 5);
  assert.equal(stockOf('p-tomate', lots), 0);
});

test('lotesVisibles oculta lotes a 0, borrados y de productos borrados, y ordena por caducidad', () => {
  assert.deepEqual(visibleLots(lots, products).map((l) => l.id), ['l4', 'l2', 'l1']);
});

test('lotesParaConsumir propone primero el que caduca antes', () => {
  const list = lotsToConsume('p-atun', lots);
  assert.deepEqual(list.map((l) => l.id), ['l2', 'l1']);
});

test('a igual caducidad, el lote con menos unidades va primero', () => {
  const two = [
    { id: 'b', producto_id: 'x', cantidad: 4, caducidad: '2026-11-01', borrado: false },
    { id: 'a', producto_id: 'x', cantidad: 1, caducidad: '2026-11-01', borrado: false },
  ];
  assert.deepEqual(lotsToConsume('x', two).map((l) => l.id), ['a', 'b']);
});

test('resumenStock: total, próxima caducidad y orden (con unidades primero)', () => {
  const summary = stockSummary(products, lots);
  assert.deepEqual(summary.map((f) => f.producto.nombre), ['Atún en aceite', 'Lentejas', 'Tomate triturado']);
  assert.equal(summary[0].total, 5);
  assert.equal(summary[0].proximaCaducidad, '2026-11-15');
  assert.equal(summary[2].total, 0);
  assert.equal(summary[2].proximaCaducidad, null);
});

test('filtrarResumen por categoría y ubicación', () => {
  const summary = stockSummary(products, lots);
  assert.deepEqual(filterSummary(summary, { categoria: 'legumbres' }).map((f) => f.producto.id), ['p-lentejas']);
  assert.deepEqual(filterSummary(summary, { ubicacion: 'Sótano' }), []);
  assert.equal(filterSummary(summary, { ubicacion: 'Despensa' }).length, 2);
});

test('aReponer solo incluye productos con mínimo mayor que 0 y stock por debajo', () => {
  const pending = toRestock(products, lots);
  // Atún has 5 with a minimum of 4: nothing missing. Tomate has 0 with a minimum of 2.
  assert.deepEqual(pending.map((f) => [f.producto.id, f.stock, f.falta]), [['p-tomate', 0, 2]]);
  assert.equal(toRestock(products, []).length, 2);
  assert.equal(toRestock([{ ...products[1], stock_minimo: 0 }], []).length, 0);
});

test('estadoCaducidad: caducado, pronto y ok según el umbral', () => {
  assert.equal(expiryStatus('2026-10-19', TODAY, 90), 'caducado');
  assert.equal(expiryStatus(TODAY, TODAY, 90), 'pronto');
  assert.equal(expiryStatus('2027-01-18', TODAY, 90), 'pronto'); // just at 90 days
  assert.equal(expiryStatus('2027-01-19', TODAY, 90), 'ok');
});

test('buscarProductoPorCodigo ignora borrados y códigos vacíos', () => {
  assert.equal(findProductByCode(products, '8410000000019').id, 'p-atun');
  assert.equal(findProductByCode(products, ''), null);
  assert.equal(findProductByCode(products, null), null);
});

test('buscarLoteIgual coincide por producto, caducidad y ubicación', () => {
  assert.equal(findSameLot(lots, { producto_id: 'p-atun', caducidad: '2026-11-15', ubicacion: 'Despensa' }).id, 'l2');
  assert.equal(findSameLot(lots, { producto_id: 'p-atun', caducidad: '2026-11-15', ubicacion: 'Sótano' }), null);
});

test('claveTexto ignora tildes, mayúsculas y espacios', () => {
  assert.equal(textKey('  Atún   en Aceite '), 'atun en aceite');
});

test('sustituirPorId reemplaza, añade y no toca el resto', () => {
  const base = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  assert.deepEqual(replaceById(base, [{ id: 'b', v: 3 }, { id: 'c', v: 4 }]), [
    { id: 'a', v: 1 }, { id: 'b', v: 3 }, { id: 'c', v: 4 },
  ]);
  assert.equal(replaceById(base, []), base);
});

test('fechas: validación, formato y días entre dos fechas', () => {
  assert.ok(isISODate('2026-02-28'));
  assert.ok(!isISODate('2026-02-30'));
  assert.ok(!isISODate('28/02/2026'));
  assert.equal(formatDate('2026-10-20'), '20/10/2026');
  assert.equal(daysBetween('2026-10-20', '2026-10-19'), -1);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
  assert.equal(describeExpiry(-1), 'Caducó ayer');
  assert.equal(describeExpiry(-5), 'Caducado hace 5 días');
  assert.equal(describeExpiry(0), 'Caduca hoy');
});

test('hoyEnMadrid usa la fecha de Madrid aunque en UTC aún sea el día anterior', () => {
  // 2026-10-19 23:30 UTC = 2026-10-20 01:30 in Madrid (CEST, UTC+2).
  assert.equal(todayInMadrid(new Date('2026-10-19T23:30:00Z')), '2026-10-20');
  // 2026-10-20 00:30 UTC = 2026-10-20 02:30 in Madrid.
  assert.equal(todayInMadrid(new Date('2026-10-20T00:30:00Z')), '2026-10-20');
});

test('configuracion: valores por defecto y validación', () => {
  const effective = effectiveSettings([{ clave: 'dias_caduca_pronto', valor: 30 }]);
  assert.equal(effective.dias_caduca_pronto, 30);
  assert.equal(effective.hora_aviso, '09:00');
  assert.equal(effective.categorias.length, 17);
  assert.deepEqual(validateValue('ubicaciones', ['  Despensa ', 'despensa', 'Nevera']), ['Despensa', 'Nevera']);
  assert.throws(() => validateValue('ubicaciones', []), /al menos una/);
  assert.throws(() => validateValue('dias_caduca_pronto', -1), /entero/);
  assert.throws(() => validateValue('emails_avisos', ['no-es-email']), /no válido/);
  assert.deepEqual(validateValue('emails_avisos', ['A@x.es', 'a@x.es']), ['a@x.es']);
  assert.throws(() => validateValue('hora_aviso', '25:00'), /HH:MM/);
  assert.throws(() => validateValue('inventado', 1), /desconocido/);
});
