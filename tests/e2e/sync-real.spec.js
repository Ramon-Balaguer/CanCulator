import { test, expect } from '@playwright/test';

// Test against the REAL test sheet (deployed Apps Script). It needs two environment variables:
//   SHEET_URL    the URL of the web application (ends in /exec)
//   SHEET_TOKEN  the token of the TOKEN property of the test script
// Without them, the test is skipped. Never use the house sheet here.
const SHEET_URL = process.env.SHEET_URL;
const SHEET_TOKEN = process.env.SHEET_TOKEN;
const CONFIGURED = Boolean(SHEET_URL && SHEET_TOKEN);

test.describe('servidor de Apps Script real', () => {
  test.skip(!CONFIGURED, 'Sin SHEET_URL y SHEET_TOKEN: se salta la prueba contra la hoja real.');

  async function send(request, body) {
    const response = await request.post(SHEET_URL, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ token: SHEET_TOKEN, ...body }),
    });
    expect(response.status()).toBe(200);
    return response.json();
  }

  test('responde al ping con la versión del servidor', async ({ request }) => {
    const r = await send(request, { accion: 'ping' });
    expect(r).toEqual({ ok: true, version: '1' });
  });

  test('rechaza un token incorrecto', async ({ request }) => {
    const response = await request.post(SHEET_URL, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ token: 'token-que-no-existe', accion: 'ping' }),
    });
    const r = await response.json();
    expect(r.ok).toBe(false);
  });

  test('una sincronización vacía devuelve la hora del servidor y las configuraciones', async ({ request }) => {
    const r = await send(request, {
      accion: 'sincronizar',
      dispositivo: 'prueba-automatica',
      desde: '',
      operaciones: [],
      configuracion: [],
    });
    expect(r.ok).toBe(true);
    expect(r.aplicadas).toEqual([]);
    expect(typeof r.ahora).toBe('string');
    expect(Array.isArray(r.cambios.lotes)).toBe(true);
  });
});
