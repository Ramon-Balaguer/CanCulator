import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pngEan13 } from '../fixtures/barcode.js';

const fixture = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

test.describe('imagen por defecto en la hoja de impresión', () => {
  test.use({ serviceWorkers: 'block' });

  test('con datos de Open Food Facts, la imagen es la del producto; sin ellos, la foto del lote', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (ruta) => ruta.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
    await page.goto('./');
    // Muesli escaneado: tiene imagen de OFF.
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(MUESLI);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    const alta = page.locator('.modal-pantalla');
    await alta.getByLabel('Caducidad').fill('2027-03-01');
    await alta.getByLabel('Unidades').fill('1');
    await alta.getByLabel('Foto (opcional)').setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
    await alta.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
    const fila = page.locator('table.tabla-imprimir tbody tr').first();
    await expect(fila.locator('img.miniatura')).toHaveAttribute('src', /images\.openfoodfacts\.org/);
  });
});
