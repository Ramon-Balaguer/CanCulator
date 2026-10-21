import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, mergeBackup, validateBackup, BACKUP_VERSION } from '../../js/logica/copia.js';
import { computeSize } from '../../js/logica/imagen.js';

const base = {
  productos: [{ id: 'p1', nombre: 'Atún', actualizado: '2026-10-01T10:00:00Z' }],
  lotes: [{ id: 'l1', producto_id: 'p1', cantidad: 3, actualizado: '2026-10-01T10:00:00Z' }],
  configuracion: [{ clave: 'dias_caduca_pronto', valor: 90 }],
  fotos: [{ id: 'f1', dato: 'AAA' }],
};

const validBackup = () => ({ formato: 'inventario-casa', version: BACKUP_VERSION, ...structuredClone(base) });

test('construirCopia crea el formato y la versión', () => {
  const backup = buildBackup({ dispositivo: 'd1', ...base, fecha: '2026-10-20T00:00:00Z' });
  assert.equal(backup.formato, 'inventario-casa');
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.dispositivo, 'd1');
  assert.equal(validateBackup(backup), backup);
});

test('validarCopia rechaza ficheros que no son copias o son de una versión futura', () => {
  assert.throws(() => validateBackup(null), /no es una copia válida/);
  assert.throws(() => validateBackup({ formato: 'otra' }), /no es una copia de Inventario/);
  assert.throws(() => validateBackup({ ...validBackup(), version: BACKUP_VERSION + 1 }), /versión más nueva/);
  assert.throws(() => validateBackup({ ...validBackup(), lotes: {} }), /no es una lista/);
  assert.throws(() => validateBackup({ ...validBackup(), lotes: [{ id: 'x', producto_id: 'p1', cantidad: -1 }] }), /Cantidad no válida/);
  assert.throws(() => validateBackup({ ...validBackup(), productos: [{ id: 'x' }] }), /sin id o sin nombre/);
});

test('fusionar: un registro nuevo se añade', () => {
  const backup = validBackup();
  backup.lotes.push({ id: 'l2', producto_id: 'p1', cantidad: 6, actualizado: '2026-10-02T00:00:00Z' });
  const r = mergeBackup(base, backup);
  assert.deepEqual(r.lotes.map((l) => l.id), ['l1', 'l2']);
  assert.equal(r.resumen.lotes, 1);
});

test('fusionar: gana el registro con actualizado más reciente', () => {
  const backup = validBackup();
  backup.lotes[0] = { ...backup.lotes[0], cantidad: 9, actualizado: '2026-10-05T00:00:00Z' };
  assert.equal(mergeBackup(base, backup).lotes[0].cantidad, 9);

  const oldBackup = validBackup();
  oldBackup.lotes[0] = { ...oldBackup.lotes[0], cantidad: 1, actualizado: '2026-09-01T00:00:00Z' };
  assert.equal(mergeBackup(base, oldBackup).lotes[0].cantidad, 3);
});

test('fusionar: en empate se queda lo local', () => {
  const backup = validBackup();
  backup.lotes[0] = { ...backup.lotes[0], cantidad: 7 };
  assert.equal(mergeBackup(base, backup).lotes[0].cantidad, 3);
});

test('fusionar: la configuración de la copia sustituye las claves que trae', () => {
  const backup = validBackup();
  backup.configuracion = [{ clave: 'dias_caduca_pronto', valor: 30 }, { clave: 'hora_aviso', valor: '08:00' }];
  const r = mergeBackup(base, backup);
  const byKey = Object.fromEntries(r.configuracion.map((c) => [c.clave, c.valor]));
  assert.deepEqual(byKey, { dias_caduca_pronto: 30, hora_aviso: '08:00' });
});

test('fusionar no pierde registros locales que no están en la copia', () => {
  const backup = { ...validBackup(), lotes: [], productos: [] };
  const r = mergeBackup(base, backup);
  assert.equal(r.lotes.length, 1);
  assert.equal(r.productos.length, 1);
});

test('calcularTamano reduce el lado mayor a 1000 px y mantiene la proporción', () => {
  assert.deepEqual(computeSize(4032, 3024), { ancho: 1000, alto: 750 });
  assert.deepEqual(computeSize(800, 600), { ancho: 800, alto: 600 });
  assert.deepEqual(computeSize(600, 3000), { ancho: 200, alto: 1000 });
  assert.throws(() => computeSize(0, 10), /dimensiones/);
});
