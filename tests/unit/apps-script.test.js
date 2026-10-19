import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarServidor } from '../fixtures/cargar-code-gs.js';

const T = 'secreto-de-prueba';
const op = (id, tipo, entidad, entidad_id, cambio, fecha) => ({ id, dispositivo: 'movil-A', fecha, tipo, entidad, entidad_id, cambio });
const sync = (servidor, operaciones, extra = {}) => servidor.llamar({ accion: 'sincronizar', token: T, dispositivo: 'movil-A', operaciones, ...extra });

function servidorConLote(cantidad = 5) {
  const s = cargarServidor();
  sync(s, [
    op('o-prod', 'crear', 'producto', 'p1', { nombre: 'Atún', categoria: 'pescado', codigo_barras: '', stock_minimo: 2 }, '2026-10-01T10:00:00Z'),
    op('o-lote', 'crear', 'lote', 'l1', { producto_id: 'p1', cantidad, caducidad: '2026-11-15', ubicacion: 'Despensa' }, '2026-10-01T10:00:01Z'),
  ]);
  return s;
}

// Lee el lote tal como está en la hoja, sin enviar cambios.
const filasLote = (s, id = 'l1') => sync(s, [], { desde: '' }).cambios.lotes.find((l) => l.id === id);

test('rechaza peticiones sin el token correcto', () => {
  const s = cargarServidor();
  const r = s.llamar({ accion: 'ping', token: 'malo' });
  assert.equal(r.ok, false);
  assert.match(r.error, /Token no válido/);
});

test('ping responde con la versión del servidor', () => {
  const s = cargarServidor();
  assert.deepEqual(s.llamar({ accion: 'ping', token: T }), { ok: true, version: '1' });
});

test('crear: el alta de producto y lote llega a la hoja', () => {
  const s = servidorConLote();
  const lote = filasLote(s);
  assert.equal(lote.cantidad, '5');
  assert.equal(lote.caducidad, '2026-11-15');
  assert.equal(lote.revisar, 'no');
});

test('consumir y reponer son incrementos que se suman (dos móviles)', () => {
  const s = servidorConLote(5);
  sync(s, [op('o-c1', 'consumir', 'lote', 'l1', { cantidad: -1 }, '2026-10-02T09:00:00Z')]);
  sync(s, [op('o-c2', 'consumir', 'lote', 'l1', { cantidad: -2 }, '2026-10-02T09:00:01Z')]);
  assert.equal(filasLote(s).cantidad, '2');
  sync(s, [op('o-r1', 'reponer', 'lote', 'l1', { cantidad: 6 }, '2026-10-03T09:00:00Z')]);
  assert.equal(filasLote(s).cantidad, '8');
});

test('una cantidad que quedaría negativa se fija a 0 y se marca para revisar', () => {
  const s = servidorConLote(1);
  sync(s, [op('o-x', 'consumir', 'lote', 'l1', { cantidad: -3 }, '2026-10-02T09:00:00Z')]);
  const lote = filasLote(s);
  assert.equal(lote.cantidad, '0');
  assert.equal(lote.revisar, 'sí');
});

test('la misma operación enviada dos veces no se aplica dos veces', () => {
  const s = servidorConLote(5);
  const consumo = op('o-dup', 'consumir', 'lote', 'l1', { cantidad: -1 }, '2026-10-02T09:00:00Z');
  const primera = sync(s, [consumo]);
  const segunda = sync(s, [consumo]);
  assert.deepEqual(primera.aplicadas, ['o-dup']);
  assert.deepEqual(segunda.duplicadas, ['o-dup']);
  assert.equal(filasLote(s).cantidad, '4');
});

test('editar: gana el valor con "actualizado" más reciente', () => {
  const s = servidorConLote();
  sync(s, [op('o-e1', 'editar', 'lote', 'l1', { caducidad: '2026-12-01' }, '2026-10-05T00:00:00Z')]);
  sync(s, [op('o-e2', 'editar', 'lote', 'l1', { caducidad: '2026-09-01' }, '2026-10-04T00:00:00Z')]);
  assert.equal(filasLote(s).caducidad, '2026-12-01');
});

test('un borrado no se revierte por una edición posterior', () => {
  const s = servidorConLote();
  sync(s, [op('o-b', 'borrar', 'lote', 'l1', { borrado: true }, '2026-10-05T00:00:00Z')]);
  sync(s, [op('o-e', 'editar', 'lote', 'l1', { ubicacion: 'Nevera' }, '2026-10-09T00:00:00Z')]);
  const lote = filasLote(s);
  assert.equal(lote.borrado, true);
  assert.equal(lote.ubicacion, 'Despensa');
});

test('devuelve todas las filas aunque "desde" sea posterior a su fecha', () => {
  // Un cambio hecho sin conexión puede tener una fecha anterior a la última sincronización de otro móvil.
  const s = servidorConLote();
  sync(s, [op('o-r', 'reponer', 'lote', 'l1', { cantidad: 1 }, '2026-10-06T00:00:00Z')]);
  assert.equal(sync(s, [], { desde: '' }).cambios.lotes.length, 1);
  assert.equal(sync(s, [], { desde: '2026-10-05T00:00:00Z' }).cambios.lotes.length, 1);
  assert.equal(sync(s, [], { desde: '2026-10-07T00:00:00Z' }).cambios.lotes.length, 1);
});

test('un cambio offline de otro móvil, con fecha anterior a la última sincronización, sí llega', () => {
  const s = servidorConLote(5);
  // A sincroniza a las 12:00; B había consumido a las 10:00 sin conexión y sincroniza después.
  const ahoraA = sync(s, [], { desde: '' }).ahora;
  sync(s, [op('o-b', 'consumir', 'lote', 'l1', { cantidad: -2 }, '2026-10-02T10:00:00Z')]);
  const r = sync(s, [], { desde: ahoraA });
  assert.equal(r.cambios.lotes.find((l) => l.id === 'l1').cantidad, '3');
});

test('configuración: gana el valor con "actualizado" más reciente', () => {
  const s = cargarServidor();
  sync(s, [], { configuracion: [{ clave: 'dias_caduca_pronto', valor: '30', actualizado: '2026-10-05T00:00:00Z' }] });
  sync(s, [], { configuracion: [{ clave: 'dias_caduca_pronto', valor: '60', actualizado: '2026-10-01T00:00:00Z' }] });
  const r = sync(s, [], { desde: '' });
  assert.equal(r.cambios.configuracion[0].valor, '30');
});

test('registra el dispositivo con su última sincronización', () => {
  const s = cargarServidor();
  const r = sync(s, []);
  const hoja = s.sim.libro.get('Dispositivos');
  assert.equal(hoja.filas[1][0], 'movil-A');
  assert.equal(hoja.filas[1][1], r.ahora);
});

test('subir una foto la guarda en Drive y es idempotente por nombre', () => {
  const s = cargarServidor();
  const a = s.llamar({ accion: 'foto', token: T, nombre: 'l1.jpg', tipo: 'image/jpeg', dato: 'AAAA' });
  const b = s.llamar({ accion: 'foto', token: T, nombre: 'l1.jpg', tipo: 'image/jpeg', dato: 'AAAA' });
  assert.equal(a.ok, true);
  assert.equal(a.id, b.id);
});

test('una acción desconocida devuelve error, no excepción', () => {
  const s = cargarServidor();
  assert.deepEqual(s.llamar({ accion: 'nada', token: T }), { ok: false, error: 'Acción desconocida' });
});

test('las fechas que Sheets convierte en Date vuelven como texto YYYY-MM-DD', () => {
  const s = servidorConLote();
  s.sim.libro.get('Lotes').filas[1][3] = new Date('2026-11-15T00:00:00Z');
  assert.equal(filasLote(s).caducidad, '2026-11-15');
});
