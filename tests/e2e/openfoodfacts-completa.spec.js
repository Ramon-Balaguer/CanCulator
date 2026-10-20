import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

// Como en openfoodfacts.spec.js: sin service worker y sin cámara, para ejecutar solo la entrada manual.
test.describe('información completa de Open Food Facts', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (ruta) => ruta.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
  });

  async function escanearMuesli(page) {
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(MUESLI);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
  }

  test('tras escanear, se ve toda la información: secciones, nutrientes y todos los campos', async ({ page }) => {
    await page.goto('./');
    await escanearMuesli(page);
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Ver todos los datos de Open Food Facts' }).click();
    const vista = page.getByRole('dialog', { name: 'Open Food Facts' });
    await expect(vista).toContainText('Ingredientes y alérgenos');
    await expect(vista).toContainText('Nutrientes por 100 g');
    await expect(vista).toContainText('Todos los campos (283)');
    await expect(vista.locator('.datos-off-fotos img').first()).toHaveAttribute('src', /images\.openfoodfacts\.org/);
  });

  test('sin conexión, el detalle de un producto guardado sigue mostrando sus datos desde la caché', async ({ page }) => {
    await page.goto('./');
    await escanearMuesli(page);
    const formulario = page.locator('.modal-pantalla');
    await formulario.getByLabel('Caducidad').fill('2027-03-01');
    await formulario.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    // Ahora sin red: solo queda la caché de IndexedDB.
    await page.unroute('https://world.openfoodfacts.org/**');
    await page.route('https://world.openfoodfacts.org/**', (ruta) => ruta.abort('internetdisconnected'));

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'muesli' }).click();
    await page.getByRole('dialog', { name: /muesli/i }).getByRole('button', { name: 'Datos de Open Food Facts' }).click();
    const vista = page.getByRole('dialog', { name: 'Open Food Facts' });
    await expect(vista).toContainText('Todos los campos (283)');
    await expect(vista).toContainText('Bjorg');
  });
});

test.describe('calorías del stock desde la caché de Open Food Facts', () => {
  test.use({ serviceWorkers: 'block' });

  test('el detalle del producto muestra kcal por bote y kcal totales del stock', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(MUESLI);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    const alta = page.locator('.modal-pantalla');
    await alta.getByLabel('Caducidad').fill('2027-03-01');
    await alta.getByLabel('Unidades').fill('2');
    await alta.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'muesli' }).click();
    await expect(page.getByTestId('kcal-producto')).toContainText('1320 kcal por bote');
    await expect(page.getByTestId('kcal-producto')).toContainText('2640 kcal en el stock (2 ud.)');
  });
});
