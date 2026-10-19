import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aReponer,
  buscarLoteIgual,
  buscarProductoPorCodigo,
  claveTexto,
  estadoCaducidad,
  filtrarResumen,
  lotesParaConsumir,
  lotesVisibles,
  resumenStock,
  stockDe,
  sustituirPorId,
} from '../../js/logica/inventario.js';
import { describirCaducidad, diasEntre, esFechaISO, formatearFecha, hoyEnMadrid } from '../../js/logica/fechas.js';
import { configuracionEfectiva, validarValor } from '../../js/logica/configuracion.js';

const HOY = '2026-10-20';

const productos = [
  { id: 'p-atun', nombre: 'Atún en aceite', categoria: 'pescado', codigo_barras: '8410000000019', stock_minimo: 4, borrado: false },
  { id: 'p-lentejas', nombre: 'Lentejas', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, borrado: false },
  { id: 'p-tomate', nombre: 'Tomate triturado', categoria: 'tomate y salsas', codigo_barras: '', stock_minimo: 2, borrado: false },
  { id: 'p-borrado', nombre: 'Viejo', categoria: 'otros', codigo_barras: '', stock_minimo: 1, borrado: true },
];

const lotes = [
  { id: 'l1', producto_id: 'p-atun', cantidad: 3, caducidad: '2027-03-01', ubicacion: 'Despensa', borrado: false },
  { id: 'l2', producto_id: 'p-atun', cantidad: 2, caducidad: '2026-11-15', ubicacion: 'Despensa', borrado: false },
  { id: 'l3', producto_id: 'p-atun', cantidad: 0, caducidad: '2026-10-01', ubicacion: 'Despensa', borrado: false },
  { id: 'l4', producto_id: 'p-lentejas', cantidad: 1, caducidad: '2026-10-19', ubicacion: 'Despensa', borrado: false },
  { id: 'l5', producto_id: 'p-tomate', cantidad: 1, caducidad: '2026-12-31', ubicacion: 'Sótano', borrado: true },
  { id: 'l6', producto_id: 'p-borrado', cantidad: 5, caducidad: '2026-11-01', ubicacion: 'Despensa', borrado: false },
];

test('stock es la suma de lotes no borrados', () => {
  assert.equal(stockDe('p-atun', lotes), 5);
  assert.equal(stockDe('p-tomate', lotes), 0);
});

test('lotesVisibles oculta lotes a 0, borrados y de productos borrados, y ordena por caducidad', () => {
  assert.deepEqual(lotesVisibles(lotes, productos).map((l) => l.id), ['l4', 'l2', 'l1']);
});

test('lotesParaConsumir propone primero el que caduca antes', () => {
  const lista = lotesParaConsumir('p-atun', lotes);
  assert.deepEqual(lista.map((l) => l.id), ['l2', 'l1']);
});

test('a igual caducidad, el lote con menos unidades va primero', () => {
  const dos = [
    { id: 'b', producto_id: 'x', cantidad: 4, caducidad: '2026-11-01', borrado: false },
    { id: 'a', producto_id: 'x', cantidad: 1, caducidad: '2026-11-01', borrado: false },
  ];
  assert.deepEqual(lotesParaConsumir('x', dos).map((l) => l.id), ['a', 'b']);
});

test('resumenStock: total, próxima caducidad y orden (con unidades primero)', () => {
  const resumen = resumenStock(productos, lotes);
  assert.deepEqual(resumen.map((f) => f.producto.nombre), ['Atún en aceite', 'Lentejas', 'Tomate triturado']);
  assert.equal(resumen[0].total, 5);
  assert.equal(resumen[0].proximaCaducidad, '2026-11-15');
  assert.equal(resumen[2].total, 0);
  assert.equal(resumen[2].proximaCaducidad, null);
});

test('filtrarResumen por categoría y ubicación', () => {
  const resumen = resumenStock(productos, lotes);
  assert.deepEqual(filtrarResumen(resumen, { categoria: 'legumbres' }).map((f) => f.producto.id), ['p-lentejas']);
  assert.deepEqual(filtrarResumen(resumen, { ubicacion: 'Sótano' }), []);
  assert.equal(filtrarResumen(resumen, { ubicacion: 'Despensa' }).length, 2);
});

test('aReponer solo incluye productos con mínimo mayor que 0 y stock por debajo', () => {
  const pendientes = aReponer(productos, lotes);
  // Atún tiene 5 de mínimo 4: no falta nada. Tomate tiene 0 de mínimo 2.
  assert.deepEqual(pendientes.map((f) => [f.producto.id, f.stock, f.falta]), [['p-tomate', 0, 2]]);
  assert.equal(aReponer(productos, []).length, 2);
  assert.equal(aReponer([{ ...productos[1], stock_minimo: 0 }], []).length, 0);
});

test('estadoCaducidad: caducado, pronto y ok según el umbral', () => {
  assert.equal(estadoCaducidad('2026-10-19', HOY, 90), 'caducado');
  assert.equal(estadoCaducidad(HOY, HOY, 90), 'pronto');
  assert.equal(estadoCaducidad('2027-01-18', HOY, 90), 'pronto'); // justo a 90 días
  assert.equal(estadoCaducidad('2027-01-19', HOY, 90), 'ok');
});

test('buscarProductoPorCodigo ignora borrados y códigos vacíos', () => {
  assert.equal(buscarProductoPorCodigo(productos, '8410000000019').id, 'p-atun');
  assert.equal(buscarProductoPorCodigo(productos, ''), null);
  assert.equal(buscarProductoPorCodigo(productos, null), null);
});

test('buscarLoteIgual coincide por producto, caducidad y ubicación', () => {
  assert.equal(buscarLoteIgual(lotes, { producto_id: 'p-atun', caducidad: '2026-11-15', ubicacion: 'Despensa' }).id, 'l2');
  assert.equal(buscarLoteIgual(lotes, { producto_id: 'p-atun', caducidad: '2026-11-15', ubicacion: 'Sótano' }), null);
});

test('claveTexto ignora tildes, mayúsculas y espacios', () => {
  assert.equal(claveTexto('  Atún   en Aceite '), 'atun en aceite');
});

test('sustituirPorId reemplaza, añade y no toca el resto', () => {
  const base = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  assert.deepEqual(sustituirPorId(base, [{ id: 'b', v: 3 }, { id: 'c', v: 4 }]), [
    { id: 'a', v: 1 }, { id: 'b', v: 3 }, { id: 'c', v: 4 },
  ]);
  assert.equal(sustituirPorId(base, []), base);
});

test('fechas: validación, formato y días entre dos fechas', () => {
  assert.ok(esFechaISO('2026-02-28'));
  assert.ok(!esFechaISO('2026-02-30'));
  assert.ok(!esFechaISO('28/02/2026'));
  assert.equal(formatearFecha('2026-10-20'), '20/10/2026');
  assert.equal(diasEntre('2026-10-20', '2026-10-19'), -1);
  assert.equal(diasEntre('2026-02-28', '2026-03-01'), 1);
  assert.equal(describirCaducidad(-1), 'Caducó ayer');
  assert.equal(describirCaducidad(-5), 'Caducado hace 5 días');
  assert.equal(describirCaducidad(0), 'Caduca hoy');
});

test('hoyEnMadrid usa la fecha de Madrid aunque en UTC aún sea el día anterior', () => {
  // 2026-10-19 23:30 UTC = 2026-10-20 01:30 en Madrid (CEST, UTC+2).
  assert.equal(hoyEnMadrid(new Date('2026-10-19T23:30:00Z')), '2026-10-20');
  // 2026-10-20 00:30 UTC = 2026-10-20 02:30 en Madrid.
  assert.equal(hoyEnMadrid(new Date('2026-10-20T00:30:00Z')), '2026-10-20');
});

test('configuracion: valores por defecto y validación', () => {
  const efectiva = configuracionEfectiva([{ clave: 'dias_caduca_pronto', valor: 30 }]);
  assert.equal(efectiva.dias_caduca_pronto, 30);
  assert.equal(efectiva.hora_aviso, '09:00');
  assert.equal(efectiva.categorias.length, 14);
  assert.deepEqual(validarValor('ubicaciones', ['  Despensa ', 'despensa', 'Nevera']), ['Despensa', 'Nevera']);
  assert.throws(() => validarValor('ubicaciones', []), /al menos una/);
  assert.throws(() => validarValor('dias_caduca_pronto', -1), /entero/);
  assert.throws(() => validarValor('emails_avisos', ['no-es-email']), /no válido/);
  assert.deepEqual(validarValor('emails_avisos', ['A@x.es', 'a@x.es']), ['a@x.es']);
  assert.throws(() => validarValor('hora_aviso', '25:00'), /HH:MM/);
  assert.throws(() => validarValor('inventado', 1), /desconocido/);
});
