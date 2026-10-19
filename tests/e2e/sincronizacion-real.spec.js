import { test, expect } from '@playwright/test';

// Prueba contra la hoja de prueba REAL (Apps Script desplegado). Necesita dos variables de entorno:
//   SHEET_URL    la URL de la aplicación web (termina en /exec)
//   SHEET_TOKEN  el token de la propiedad TOKEN del script de prueba
// Sin ellas, la prueba se salta. Nunca uses la hoja de la casa aquí.
const URL_HOJA = process.env.SHEET_URL;
const TOKEN_HOJA = process.env.SHEET_TOKEN;
const CONFIGURADA = Boolean(URL_HOJA && TOKEN_HOJA);

test.describe('servidor de Apps Script real', () => {
  test.skip(!CONFIGURADA, 'Sin SHEET_URL y SHEET_TOKEN: se salta la prueba contra la hoja real.');

  async function enviar(request, cuerpo) {
    const respuesta = await request.post(URL_HOJA, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ token: TOKEN_HOJA, ...cuerpo }),
    });
    expect(respuesta.status()).toBe(200);
    return respuesta.json();
  }

  test('responde al ping con la versión del servidor', async ({ request }) => {
    const r = await enviar(request, { accion: 'ping' });
    expect(r).toEqual({ ok: true, version: '1' });
  });

  test('rechaza un token incorrecto', async ({ request }) => {
    const respuesta = await request.post(URL_HOJA, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      data: JSON.stringify({ token: 'token-que-no-existe', accion: 'ping' }),
    });
    const r = await respuesta.json();
    expect(r.ok).toBe(false);
  });

  test('una sincronización vacía devuelve la hora del servidor y las configuraciones', async ({ request }) => {
    const r = await enviar(request, {
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
