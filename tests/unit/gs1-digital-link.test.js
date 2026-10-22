import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gtinDesdeDigitalLink, codigoDesdeTexto, caducidadDesdeDigitalLink, pesoDesdeDigitalLink, precioDesdeDigitalLink } from '../../js/logica/gs1-digital-link.js';

test('gtinDesdeDigitalLink saca el GTIN de una URL GS1 Digital Link', () => {
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/04006381333931'), '4006381333931');
});

test('gtinDesdeDigitalLink ignora los demás identificadores de la URL (lote, caducidad)', () => {
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/04006381333931/10/ABC123/17/261231'), '4006381333931');
});

test('gtinDesdeDigitalLink convierte un GTIN-14 con indicador 0 a EAN-13', () => {
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/00000000000000'), '0000000000000');
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/03229820129488'), '3229820129488');
});

test('gtinDesdeDigitalLink conserva un GTIN-14 que no es EAN-13', () => {
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/14006381333938'), '14006381333938');
});

test('gtinDesdeDigitalLink devuelve null si no es una URL Digital Link válida', () => {
  assert.equal(gtinDesdeDigitalLink('4006381333931'), null);
  assert.equal(gtinDesdeDigitalLink('https://ejemplo.com/producto/4006381333931'), null);
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/10/ABC123'), null);
  assert.equal(gtinDesdeDigitalLink('no es una url'), null);
});

test('gtinDesdeDigitalLink rechaza un GTIN con dígito de control incorrecto', () => {
  assert.equal(gtinDesdeDigitalLink('https://id.gs1.org/01/04006381333932'), null);
});

test('codigoDesdeTexto usa el GTIN de la URL y, si no hay URL, el texto normalizado', () => {
  assert.equal(codigoDesdeTexto('https://id.gs1.org/01/04006381333931/10/L1'), '4006381333931');
  assert.equal(codigoDesdeTexto(' 400 6381-333931 '), '4006381333931');
});

test('caducidadDesdeDigitalLink saca la fecha del identificador 17 (AAMMDD)', () => {
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/10/L1/17/261231'), '2026-12-31');
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/270301'), '2027-03-01');
});

test('caducidadDesdeDigitalLink usa el último día del mes cuando el día es 00', () => {
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/280200'), '2028-02-29');
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/270200'), '2027-02-28');
});

test('caducidadDesdeDigitalLink devuelve null si no viene informada o no es una fecha', () => {
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/10/L1'), null);
  assert.equal(caducidadDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/261332'), null);
  assert.equal(caducidadDesdeDigitalLink('4006381333931'), null);
});

// Real label (Mercadona): the GTIN is in the path, the data attributes 17 and others in the query string.
const MERCADONA = 'https://qrtrack.mercadona.es/01/08436569260821/10/000678318001?17=261024&16=261021&3103=000459&3922=00826&8005=001800';

test('etiqueta real de Mercadona: el código es su GTIN y la caducidad va en la query string (17)', () => {
  assert.equal(codigoDesdeTexto(MERCADONA), '8436569260821');
  assert.equal(caducidadDesdeDigitalLink(MERCADONA), '2026-10-24');
});

test('pesoDesdeDigitalLink saca el peso neto en gramos del identificador 310n (kilos con n decimales)', () => {
  assert.equal(pesoDesdeDigitalLink(MERCADONA), 459);
  assert.equal(pesoDesdeDigitalLink('https://id.gs1.org/01/04006381333931/3102/000250'), 2500);
});

test('pesoDesdeDigitalLink devuelve null si el QR no trae peso', () => {
  assert.equal(pesoDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/261231'), null);
  assert.equal(pesoDesdeDigitalLink('4006381333931'), null);
});

test('precioDesdeDigitalLink saca el importe en euros del identificador 390n o 392n (n decimales)', () => {
  assert.equal(precioDesdeDigitalLink(MERCADONA), 8.26);
  assert.equal(precioDesdeDigitalLink('https://id.gs1.org/01/04006381333931/3902/000199'), 1.99);
});

test('precioDesdeDigitalLink devuelve null si el QR no trae precio o vale 0', () => {
  assert.equal(precioDesdeDigitalLink('https://id.gs1.org/01/04006381333931/17/261231'), null);
  assert.equal(precioDesdeDigitalLink('https://id.gs1.org/01/04006381333931/3922/00000'), null);
});
