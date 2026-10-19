import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirCopia, fusionarCopia, validarCopia, VERSION_COPIA } from '../../js/logica/copia.js';
import { calcularTamano } from '../../js/logica/imagen.js';

const base = {
  productos: [{ id: 'p1', nombre: 'Atún', actualizado: '2026-10-01T10:00:00Z' }],
  lotes: [{ id: 'l1', producto_id: 'p1', cantidad: 3, actualizado: '2026-10-01T10:00:00Z' }],
  configuracion: [{ clave: 'dias_caduca_pronto', valor: 90 }],
  fotos: [{ id: 'f1', dato: 'AAA' }],
};

const copiaValida = () => ({ formato: 'inventario-casa', version: VERSION_COPIA, ...structuredClone(base) });

test('construirCopia crea el formato y la versión', () => {
  const copia = construirCopia({ dispositivo: 'd1', ...base, fecha: '2026-10-20T00:00:00Z' });
  assert.equal(copia.formato, 'inventario-casa');
  assert.equal(copia.version, VERSION_COPIA);
  assert.equal(copia.dispositivo, 'd1');
  assert.equal(validarCopia(copia), copia);
});

test('validarCopia rechaza ficheros que no son copias o son de una versión futura', () => {
  assert.throws(() => validarCopia(null), /no es una copia válida/);
  assert.throws(() => validarCopia({ formato: 'otra' }), /no es una copia de Inventario/);
  assert.throws(() => validarCopia({ ...copiaValida(), version: VERSION_COPIA + 1 }), /versión más nueva/);
  assert.throws(() => validarCopia({ ...copiaValida(), lotes: {} }), /no es una lista/);
  assert.throws(() => validarCopia({ ...copiaValida(), lotes: [{ id: 'x', producto_id: 'p1', cantidad: -1 }] }), /Cantidad no válida/);
  assert.throws(() => validarCopia({ ...copiaValida(), productos: [{ id: 'x' }] }), /sin id o sin nombre/);
});

test('fusionar: un registro nuevo se añade', () => {
  const copia = copiaValida();
  copia.lotes.push({ id: 'l2', producto_id: 'p1', cantidad: 6, actualizado: '2026-10-02T00:00:00Z' });
  const r = fusionarCopia(base, copia);
  assert.deepEqual(r.lotes.map((l) => l.id), ['l1', 'l2']);
  assert.equal(r.resumen.lotes, 1);
});

test('fusionar: gana el registro con actualizado más reciente', () => {
  const copia = copiaValida();
  copia.lotes[0] = { ...copia.lotes[0], cantidad: 9, actualizado: '2026-10-05T00:00:00Z' };
  assert.equal(fusionarCopia(base, copia).lotes[0].cantidad, 9);

  const copiaVieja = copiaValida();
  copiaVieja.lotes[0] = { ...copiaVieja.lotes[0], cantidad: 1, actualizado: '2026-09-01T00:00:00Z' };
  assert.equal(fusionarCopia(base, copiaVieja).lotes[0].cantidad, 3);
});

test('fusionar: en empate se queda lo local', () => {
  const copia = copiaValida();
  copia.lotes[0] = { ...copia.lotes[0], cantidad: 7 };
  assert.equal(fusionarCopia(base, copia).lotes[0].cantidad, 3);
});

test('fusionar: la configuración de la copia sustituye las claves que trae', () => {
  const copia = copiaValida();
  copia.configuracion = [{ clave: 'dias_caduca_pronto', valor: 30 }, { clave: 'hora_aviso', valor: '08:00' }];
  const r = fusionarCopia(base, copia);
  const porClave = Object.fromEntries(r.configuracion.map((c) => [c.clave, c.valor]));
  assert.deepEqual(porClave, { dias_caduca_pronto: 30, hora_aviso: '08:00' });
});

test('fusionar no pierde registros locales que no están en la copia', () => {
  const copia = { ...copiaValida(), lotes: [], productos: [] };
  const r = fusionarCopia(base, copia);
  assert.equal(r.lotes.length, 1);
  assert.equal(r.productos.length, 1);
});

test('calcularTamano reduce el lado mayor a 1000 px y mantiene la proporción', () => {
  assert.deepEqual(calcularTamano(4032, 3024), { ancho: 1000, alto: 750 });
  assert.deepEqual(calcularTamano(800, 600), { ancho: 800, alto: 600 });
  assert.deepEqual(calcularTamano(600, 3000), { ancho: 200, alto: 1000 });
  assert.throws(() => calcularTamano(0, 10), /dimensiones/);
});
