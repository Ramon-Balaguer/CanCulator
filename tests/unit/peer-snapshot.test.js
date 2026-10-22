import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshot } from '../../js/logica/peer-sync.js';

const lote = (id, cantidad, actualizado, extra = {}) => ({ id, producto_id: 'p1', cantidad, caducidad: '2027-01-01', ubicacion: 'Despensa', revisar: 'no', actualizado, borrado: false, ...extra });
const producto = (id, nombre, actualizado) => ({ id, nombre, categoria: 'pescado', codigo_barras: '', stock_minimo: 0, actualizado, borrado: false });

test('un lote que solo existe en el otro móvil se añade (aunque sus operaciones se perdieran)', () => {
  const local = { productos: [producto('p1', 'Atún', '2026-10-01')], lotes: [], configuracion: [] };
  const remoto = { productos: [], lotes: [lote('l9', 3, '2026-10-02')], configuracion: [] };
  const r = mergeSnapshot(local, remoto);
  assert.deepEqual(r.state.lotes.map((l) => l.id), ['l9']);
  assert.equal(r.changed, 1);
});

test('un registro remoto más reciente sustituye al local', () => {
  const local = { productos: [], lotes: [lote('l1', 5, '2026-10-01')], configuracion: [] };
  const remoto = { productos: [], lotes: [lote('l1', 2, '2026-10-03')], configuracion: [] };
  const r = mergeSnapshot(local, remoto);
  assert.equal(r.state.lotes[0].cantidad, 2);
  assert.equal(r.changed, 1);
});

test('un registro local más reciente o igual no se cambia', () => {
  const local = { productos: [], lotes: [lote('l1', 5, '2026-10-04')], configuracion: [] };
  const remoto = { productos: [], lotes: [lote('l1', 2, '2026-10-03')], configuracion: [] };
  const r = mergeSnapshot(local, remoto);
  assert.equal(r.state.lotes[0].cantidad, 5);
  assert.equal(r.changed, 0);
});

test('un borrado remoto más reciente se propaga al local', () => {
  const local = { productos: [producto('p1', 'Atún', '2026-10-01')], lotes: [], configuracion: [] };
  const remoto = { productos: [producto('p1', 'Atún', '2026-10-05')].map((p) => ({ ...p, borrado: true })), lotes: [], configuracion: [] };
  const r = mergeSnapshot(local, remoto);
  assert.equal(r.state.productos[0].borrado, true);
});

test('los ajustes se fusionan por clave con el mismo criterio', () => {
  const local = { productos: [], lotes: [], configuracion: [{ clave: 'categorias', valor: ['a'], actualizado: '2026-10-01' }] };
  const remoto = {
    productos: [],
    lotes: [],
    configuracion: [
      { clave: 'categorias', valor: ['a', 'b'], actualizado: '2026-10-02' },
      { clave: 'ubicaciones', valor: ['Nevera'], actualizado: '2026-10-02' },
    ],
  };
  const r = mergeSnapshot(local, remoto);
  assert.deepEqual(r.state.configuracion.find((c) => c.clave === 'categorias').valor, ['a', 'b']);
  assert.deepEqual(r.state.configuracion.find((c) => c.clave === 'ubicaciones').valor, ['Nevera']);
  assert.equal(r.changed, 2);
});

test('dos fusiones seguidas con el mismo snapshot no cambian nada la segunda vez', () => {
  const local = { productos: [], lotes: [], configuracion: [] };
  const remoto = { productos: [producto('p1', 'Atún', '2026-10-01')], lotes: [lote('l1', 1, '2026-10-01')], configuracion: [] };
  const primera = mergeSnapshot(local, remoto);
  const segunda = mergeSnapshot(primera.state, remoto);
  assert.equal(segunda.changed, 0);
});

test('no modifica el estado de entrada', () => {
  const local = { productos: [], lotes: [lote('l1', 5, '2026-10-01')], configuracion: [] };
  mergeSnapshot(local, { productos: [], lotes: [lote('l1', 2, '2026-10-03')], configuracion: [] });
  assert.equal(local.lotes[0].cantidad, 5);
});
