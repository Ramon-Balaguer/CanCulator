import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

// As in openfoodfacts.spec.js: no service worker and no camera, to run only the manual entry.
test.describe('información completa de Open Food Facts', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
  });

  async function scanMuesli(page) {
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const scanner = page.getByRole('dialog', { name: 'Escanear código' });
    await scanner.getByLabel('O escribe el código').fill(MUESLI);
    await scanner.getByRole('button', { name: 'Usar este código' }).click();
  }

  test('tras escanear, se ve toda la información: secciones, nutrientes y todos los campos', async ({ page }) => {
    await page.goto('./');
    await scanMuesli(page);
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Ver todos los datos de Open Food Facts' }).click();
    const view2 = page.getByRole('dialog', { name: 'Open Food Facts' });
    await expect(view2).toContainText('Ingredientes y alérgenos');
    await expect(view2).toContainText('Nutrientes por 100 g');
    await expect(view2).toContainText('Todos los campos (283)');
    await expect(view2.locator('.datos-off-fotos img').first()).toHaveAttribute('src', /images\.openfoodfacts\.org/);
  });

  test('sin conexión, el detalle de un producto guardado sigue mostrando sus datos desde la caché', async ({ page }) => {
    await page.goto('./');
    await scanMuesli(page);
    const form = page.locator('.modal-pantalla');
    await form.getByLabel('Caducidad').fill('2027-03-01');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    // Now without network: only the IndexedDB cache is left.
    await page.unroute('https://world.openfoodfacts.org/**');
    await page.route('https://world.openfoodfacts.org/**', (route) => route.abort('internetdisconnected'));

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'muesli' }).click();
    await page.getByRole('dialog', { name: /muesli/i }).getByRole('button', { name: 'Datos de Open Food Facts' }).click();
    const view2 = page.getByRole('dialog', { name: 'Open Food Facts' });
    await expect(view2).toContainText('Todos los campos (283)');
    await expect(view2).toContainText('Bjorg');
  });
});

test.describe('calorías del stock desde la caché de Open Food Facts', () => {
  test.use({ serviceWorkers: 'block' });

  test('el detalle del producto muestra kcal por bote y kcal totales del stock', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const scanner = page.getByRole('dialog', { name: 'Escanear código' });
    await scanner.getByLabel('O escribe el código').fill(MUESLI);
    await scanner.getByRole('button', { name: 'Usar este código' }).click();
    const newLotTest = page.locator('.modal-pantalla');
    await newLotTest.getByLabel('Caducidad').fill('2027-03-01');
    await newLotTest.getByLabel('Unidades').fill('2');
    await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'muesli' }).click();
    await expect(page.getByTestId('kcal-producto')).toContainText('1320 kcal por bote');
    await expect(page.getByTestId('kcal-producto')).toContainText('2640 kcal en el stock (2 ud.)');
  });
});
