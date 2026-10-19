import { test, expect } from '@playwright/test';
import { CODIGO_PRUEBA, pngEan13 } from '../fixtures/codigo-barras.js';

test('la página de prueba de cámara carga Preact, htm y ZXing', async ({ page }) => {
  const errores = [];
  page.on('pageerror', (error) => errores.push(error.message));
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('link', { name: 'Prueba de cámara y código de barras' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prueba de cámara');
  await expect(page.getByRole('button', { name: 'Abrir cámara' })).toBeVisible();
  await expect(page.getByTestId('estado-camara')).toHaveText('Cámara parada');
  await expect(page.locator('.diagnostico')).toContainText('Contexto seguro (HTTPS)');
  expect(errores).toEqual([]);
});

test('lee un código EAN-13 desde una foto', async ({ page }) => {
  await page.goto('prueba-camara.html');
  await page.getByTestId('foto').setInputFiles({
    name: 'lata.png',
    mimeType: 'image/png',
    buffer: pngEan13(CODIGO_PRUEBA),
  });
  await expect(page.getByTestId('codigo-leido')).toHaveText(CODIGO_PRUEBA);
  await expect(page.getByTestId('codigo-detalle')).toHaveText('EAN-13 · dígito de control correcto · desde foto');
});

test('una foto sin código muestra un aviso y no rompe la página', async ({ page }) => {
  await page.goto('prueba-camara.html');
  await page.getByTestId('foto').setInputFiles({
    name: 'blanco.png',
    mimeType: 'image/png',
    buffer: pngEan13(CODIGO_PRUEBA, { altoBarras: 0 }),
  });
  await expect(page.getByRole('alert')).toHaveText('No se ha encontrado ningún código de barras en la imagen.');
  await expect(page.getByRole('button', { name: 'Abrir cámara' })).toBeVisible();
});

test('lee un código EAN-13 con la cámara en vivo', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Solo Chromium permite una cámara simulada con un vídeo propio. En iPhone se prueba a mano.');
  await page.goto('prueba-camara.html');
  await page.getByRole('button', { name: 'Abrir cámara' }).click();
  await expect(page.getByTestId('codigo-leido')).toHaveText(CODIGO_PRUEBA, { timeout: 15_000 });
  await expect(page.getByTestId('codigo-detalle')).toContainText('desde cámara');
  // Tras leer, la cámara se apaga para no gastar batería.
  await expect(page.getByTestId('estado-camara')).toHaveText('Cámara parada');
});
