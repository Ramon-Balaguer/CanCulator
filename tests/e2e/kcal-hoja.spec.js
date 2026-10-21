import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startFakeSheet } from './hoja-falsa.js';
import { ownServer } from './servidor-propio.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

test.describe('calorías guardadas en la hoja y vistas desde otro móvil', () => {
  test.use({ serviceWorkers: 'block' });
  // Dos móviles y sincronizaciones: más margen que el de por defecto.
  test.setTimeout(120_000);
  let sheet;
  let app;

  test.beforeEach(async () => {
    sheet = await startFakeSheet();
    app = await ownServer();
  });
  test.afterEach(async () => {
    await app?.cortar();
    await sheet?.cerrar();
  });

  async function configure(page) {
    await page.goto(app.url);
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('URL de Apps Script').fill(sheet.url);
    await page.getByLabel('Token').fill(sheet.token);
    await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
  }

  async function sync(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
  }

  test('el móvil que escanea guarda las kcal en la hoja; el otro móvil las ve en Stock', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const phoneA = await contextA.newPage();
    const phoneB = await contextB.newPage();
    try {
      // Móvil A: escanea el muesli con Open Food Facts (simulado) y lo da de alta.
      await phoneA.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
      }));
      await phoneA.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
      });
      await configure(phoneA);
      await phoneA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
      await phoneA.getByRole('button', { name: 'Añadir lote' }).click();
      await phoneA.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
      const scanner = phoneA.getByRole('dialog', { name: 'Escanear código' });
      await scanner.getByLabel('O escribe el código').fill(MUESLI);
      await scanner.getByRole('button', { name: 'Usar este código' }).click();
      const newLotTest = phoneA.locator('.modal-pantalla');
      await newLotTest.getByLabel('Caducidad').fill('2027-03-01');
      await newLotTest.getByLabel('Unidades').fill('2');
      await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
      await sync(phoneA);

      // La hoja tiene las calorías del producto.
      const products = sheet.hojas.get('Productos');
      const header = products.filas[0];
      const row = products.filas.find((r) => r[header.indexOf('codigo_barras')] === MUESLI);
      expect(row[header.indexOf('kcal_100g')]).toBe('352');
      expect(row[header.indexOf('peso_bote_g')]).toBe('375');

      // Móvil B: no ha escaneado nada ni tiene caché de OFF. Solo sincroniza.
      await configure(phoneB);
      await phoneB.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Estadísticas' }).click();
      await expect(phoneB.getByTestId('kcal-total')).toHaveText('2640 kcal', { timeout: 20_000 });
      await expect(phoneB.getByTestId('unidades-total')).toHaveText('2');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
