import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { iniciarHojaFalsa } from './hoja-falsa.js';
import { servidorPropio } from './servidor-propio.js';

const fixture = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

test.describe('calorías guardadas en la hoja y vistas desde otro móvil', () => {
  test.use({ serviceWorkers: 'block' });
  // Dos móviles y sincronizaciones: más margen que el de por defecto.
  test.setTimeout(120_000);
  let hoja;
  let app;

  test.beforeEach(async () => {
    hoja = await iniciarHojaFalsa();
    app = await servidorPropio();
  });
  test.afterEach(async () => {
    await app?.cortar();
    await hoja?.cerrar();
  });

  async function configurar(page) {
    await page.goto(app.url);
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('URL de Apps Script').fill(hoja.url);
    await page.getByLabel('Token').fill(hoja.token);
    await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
  }

  async function sincronizar(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
  }

  test('el móvil que escanea guarda las kcal en la hoja; el otro móvil las ve en Stock', async ({ browser }) => {
    const contextoA = await browser.newContext();
    const contextoB = await browser.newContext();
    const movilA = await contextoA.newPage();
    const movilB = await contextoB.newPage();
    try {
      // Móvil A: escanea el muesli con Open Food Facts (simulado) y lo da de alta.
      await movilA.route('https://world.openfoodfacts.org/**', (ruta) => ruta.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
      }));
      await movilA.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
      });
      await configurar(movilA);
      await movilA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
      await movilA.getByRole('button', { name: 'Añadir lote' }).click();
      await movilA.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
      const escaner = movilA.getByRole('dialog', { name: 'Escanear código' });
      await escaner.getByLabel('O escribe el código').fill(MUESLI);
      await escaner.getByRole('button', { name: 'Usar este código' }).click();
      const alta = movilA.locator('.modal-pantalla');
      await alta.getByLabel('Caducidad').fill('2027-03-01');
      await alta.getByLabel('Unidades').fill('2');
      await alta.getByRole('button', { name: 'Guardar lote' }).click();
      await sincronizar(movilA);

      // La hoja tiene las calorías del producto.
      const productos = hoja.hojas.get('Productos');
      const cabecera = productos.filas[0];
      const fila = productos.filas.find((r) => r[cabecera.indexOf('codigo_barras')] === MUESLI);
      expect(fila[cabecera.indexOf('kcal_100g')]).toBe('352');
      expect(fila[cabecera.indexOf('peso_bote_g')]).toBe('375');

      // Móvil B: no ha escaneado nada ni tiene caché de OFF. Solo sincroniza.
      await configurar(movilB);
      await movilB.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Estadísticas' }).click();
      await expect(movilB.getByTestId('kcal-total')).toHaveText('2640 kcal', { timeout: 20_000 });
      await expect(movilB.getByTestId('unidades-total')).toHaveText('2');
    } finally {
      await contextoA.close();
      await contextoB.close();
    }
  });
});
