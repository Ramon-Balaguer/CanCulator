import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRemoteOps, hashToken } from '../../js/logica/peer-sync.js';

const op = (id, tipo, entidad, entidad_id, cambio, fecha) => ({ id, dispositivo: 'B', fecha, tipo, entidad, entidad_id, cambio });
const base = () => ({
  productos: [{ id: 'p1', nombre: 'Atún', categoria: 'pescado', codigo_barras: '', stock_minimo: 0, actualizado: '2026-10-01T00:00:00Z', borrado: false }],
  lotes: [{ id: 'l1', producto_id: 'p1', cantidad: 5, caducidad: '2027-01-01', ubicacion: 'Despensa', observaciones: '', foto_id: '', revisar: 'no', actualizado: '2026-10-01T00:00:00Z', borrado: false }],
});

test('el saludo usa una huella del token, no el token', async () => {
  const h = await hashToken('secreto');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, 'secreto');
  assert.equal(h, await hashToken('secreto'));
  assert.notEqual(h, await hashToken('otro'));
});

test('dos consumos recibidos se suman', () => {
  const r = applyRemoteOps(base(), [
    op('o1', 'consumir', 'lote', 'l1', { cantidad: -1 }, '2026-10-02T09:00:00Z'),
    op('o2', 'consumir', 'lote', 'l1', { cantidad: -2 }, '2026-10-02T09:00:01Z'),
  ], new Set());
  assert.equal(r.state.lotes[0].cantidad, 2);
  assert.deepEqual(r.applied, ['o1', 'o2']);
});

test('una operación ya aplicada no se vuelve a aplicar', () => {
  const r = applyRemoteOps(base(), [op('o1', 'consumir', 'lote', 'l1', { cantidad: -1 }, '2026-10-02T09:00:00Z')], new Set(['o1']));
  assert.equal(r.state.lotes[0].cantidad, 5);
  assert.deepEqual(r.applied, []);
});

test('una cantidad que quedaría negativa se fija a 0 y se marca para revisar', () => {
  const r = applyRemoteOps(base(), [op('o1', 'consumir', 'lote', 'l1', { cantidad: -9 }, '2026-10-02T09:00:00Z')], new Set());
  assert.equal(r.state.lotes[0].cantidad, 0);
  assert.equal(r.state.lotes[0].revisar, 'sí');
});

test('una edición más antigua que la del registro no se aplica', () => {
  const s = base();
  s.lotes[0].actualizado = '2026-10-05T00:00:00Z';
  const r = applyRemoteOps(s, [op('o1', 'editar', 'lote', 'l1', { ubicacion: 'Nevera' }, '2026-10-04T00:00:00Z')], new Set());
  assert.equal(r.state.lotes[0].ubicacion, 'Despensa');
});

test('una edición más reciente sí se aplica', () => {
  const r = applyRemoteOps(base(), [op('o1', 'editar', 'lote', 'l1', { caducidad: '2027-06-01' }, '2026-10-05T00:00:00Z')], new Set());
  assert.equal(r.state.lotes[0].caducidad, '2027-06-01');
});

test('un borrado no se revierte por una edición posterior', () => {
  const r = applyRemoteOps(base(), [
    op('o1', 'borrar', 'lote', 'l1', { borrado: true }, '2026-10-05T00:00:00Z'),
    op('o2', 'editar', 'lote', 'l1', { ubicacion: 'Nevera' }, '2026-10-09T00:00:00Z'),
  ], new Set());
  assert.equal(r.state.lotes[0].borrado, true);
  assert.equal(r.state.lotes[0].ubicacion, 'Despensa');
});

test('crear un lote que ya existe no lo duplica', () => {
  const r = applyRemoteOps(base(), [op('o1', 'crear', 'lote', 'l1', { producto_id: 'p1', cantidad: 9, caducidad: '2027-01-01', ubicacion: 'Despensa' }, '2026-10-02T00:00:00Z')], new Set());
  assert.equal(r.state.lotes.length, 1);
  assert.equal(r.state.lotes[0].cantidad, 5);
});

test('crear un lote nuevo lo añade con sus datos', () => {
  const r = applyRemoteOps(base(), [op('o2', 'crear', 'lote', 'l2', { producto_id: 'p1', cantidad: 3, caducidad: '2027-02-01', ubicacion: 'Despensa' }, '2026-10-02T00:00:00Z')], new Set());
  assert.equal(r.state.lotes.length, 2);
  assert.equal(r.state.lotes[1].cantidad, 3);
  assert.equal(r.state.lotes[1].revisar, 'no');
});

test('no modifica el estado de entrada', () => {
  const s = base();
  applyRemoteOps(s, [op('o1', 'consumir', 'lote', 'l1', { cantidad: -1 }, '2026-10-02T09:00:00Z')], new Set());
  assert.equal(s.lotes[0].cantidad, 5);
});
