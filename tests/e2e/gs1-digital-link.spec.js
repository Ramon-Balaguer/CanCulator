import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The QR of a product carries a GS1 Digital Link: its GTIN is the code to look up in Open Food Facts.
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const GTIN = '4006381333931';
const DIGITAL_LINK = `https://id.gs1.org/01/0${GTIN}/10/LOTE1/17/261231`;

test.describe('QR GS1 Digital Link en el escáner', () => {
  // Without a service worker and without a camera, as in the Open Food Facts tests.
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fixture('no-encontrado').cuerpo),
      }),
    );
  });

  test('escribir la URL del QR usa su GTIN como código del producto', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(DIGITAL_LINK);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    await expect(page.locator('.modal-pantalla')).toContainText(GTIN);
  });

  test('si el QR trae la caducidad, rellena el campo Caducidad', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(DIGITAL_LINK);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    await expect(page.locator('.modal-pantalla').getByLabel('Caducidad')).toHaveValue('2026-12-31');
  });
});

test.describe('etiqueta de Mercadona en el escáner', () => {
  test.use({ serviceWorkers: 'block' });

  test('escribir la URL de la etiqueta rellena el código y la caducidad', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('no-encontrado').cuerpo),
    }));
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill('https://qrtrack.mercadona.es/01/08436569260821/10/000678318001?17=261024&16=261021&3103=000459&3922=00826&8005=001800');
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    await expect(page.locator('.modal-pantalla')).toContainText('8436569260821');
    await expect(page.locator('.modal-pantalla').getByLabel('Caducidad')).toHaveValue('2026-10-24');
  });
});
