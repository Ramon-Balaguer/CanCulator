import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aplicarCambiosServidor,
  construirPeticionSync,
  entidadesPendientes,
  idsConfirmados,
  interpretarRespuestaSync,
} from '../../js/logica/sincronizacion.js';

const op = (id, entidad, entidad_id) => ({ id, dispositivo: 'A', fecha: '2026-10-02T00:00:00Z', tipo: 'consumir', entidad, entidad_id, cambio: { cantidad: -1 } });

test('la petición lleva token, dispositivo, operaciones y configuración con valor en JSON', () => {
  const p = construirPeticionSync({
    token: 't',
    dispositivo: 'A',
    operaciones: [op('o1', 'lote', 'l1')],
    desde: '2026-10-01T00:00:00Z',
    configuracion: [{ clave: 'categorias', valor: ['a', 'b'], actualizado: '2026-10-01T00:00:00Z' }],
  });
  assert.equal(p.accion, 'sincronizar');
  assert.equal(p.token, 't');
  assert.equal(p.operaciones.length, 1);
  assert.deepEqual(p.configuracion, [{ clave: 'categorias', valor: '["a","b"]', actualizado: '2026-10-01T00:00:00Z' }]);
});

test('interpretarRespuestaSync rechaza errores y respuestas incompletas', () => {
  assert.throws(() => interpretarRespuestaSync({ ok: false, error: 'Token no válido' }), /Token no válido/);
  assert.throws(() => interpretarRespuestaSync({ ok: true, aplicadas: [] }), /incompleta/);
  assert.throws(() => interpretarRespuestaSync(null), /no válida/);
  const buena = { ok: true, aplicadas: ['o1'], duplicadas: [], ahora: '2026-10-02T00:00:00Z' };
  assert.equal(interpretarRespuestaSync(buena), buena);
});

test('idsConfirmados incluye aplicadas y duplicadas', () => {
  const ids = idsConfirmados({ aplicadas: ['a'], duplicadas: ['b'] });
  assert.deepEqual([...ids].sort(), ['a', 'b']);
});

test('entidadesPendientes marca lo que tiene operaciones sin confirmar', () => {
  const p = entidadesPendientes([op('o1', 'lote', 'l1')]);
  assert.ok(p.has('lote:l1'));
  assert.ok(!p.has('lote:l2'));
});

test('aplicar cambios: un registro remoto más reciente sustituye al local', () => {
  const local = { productos: [], lotes: [{ id: 'l1', cantidad: 5, actualizado: '2026-10-01T00:00:00Z', borrado: false }], configuracion: [] };
  const cambios = { lotes: [{ id: 'l1', cantidad: '3', actualizado: '2026-10-03T00:00:00Z', borrado: false, revisar: 'no' }] };
  const r = aplicarCambiosServidor(local, cambios, new Set());
  assert.equal(r.lotes[0].cantidad, 3);
  assert.equal(typeof r.lotes[0].cantidad, 'number');
});

test('aplicar cambios: no pisa una entidad con operaciones pendientes', () => {
  const local = { productos: [], lotes: [{ id: 'l1', cantidad: 4, actualizado: '2026-10-01T00:00:00Z', borrado: false }], configuracion: [] };
  const cambios = { lotes: [{ id: 'l1', cantidad: '3', actualizado: '2026-10-03T00:00:00Z', borrado: false }] };
  const r = aplicarCambiosServidor(local, cambios, entidadesPendientes([op('o1', 'lote', 'l1')]));
  assert.equal(r.lotes[0].cantidad, 4);
});

test('aplicar cambios: un registro local más reciente se conserva', () => {
  const local = { productos: [], lotes: [{ id: 'l1', cantidad: 2, actualizado: '2026-10-05T00:00:00Z', borrado: false }], configuracion: [] };
  const cambios = { lotes: [{ id: 'l1', cantidad: '9', actualizado: '2026-10-03T00:00:00Z', borrado: false }] };
  assert.equal(aplicarCambiosServidor(local, cambios, new Set()).lotes[0].cantidad, 2);
});

test('aplicar cambios: el borrado llega como booleano y las filas nuevas se añaden', () => {
  const local = { productos: [], lotes: [], configuracion: [] };
  const cambios = { lotes: [{ id: 'l9', cantidad: '1', actualizado: '2026-10-03T00:00:00Z', borrado: 'sí' }] };
  const r = aplicarCambiosServidor(local, cambios, new Set());
  assert.equal(r.lotes.length, 1);
  assert.equal(r.lotes[0].borrado, true);
});

test('aplicar cambios: la configuración se decodifica desde JSON', () => {
  const local = { productos: [], lotes: [], configuracion: [] };
  const cambios = { configuracion: [{ clave: 'dias_caduca_pronto', valor: '60', actualizado: '2026-10-03T00:00:00Z' }] };
  const r = aplicarCambiosServidor(local, cambios, new Set());
  assert.equal(r.configuracion[0].valor, 60);
});
