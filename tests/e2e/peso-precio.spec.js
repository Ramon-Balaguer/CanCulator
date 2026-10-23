import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Weight and price are optional product fields. The QR label brings them in its link (Mercadona);
// a barcode brings the price from Open Prices (the prices project of Open Food Facts).
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MERCADONA = 'https://qrtrack.mercadona.es/01/08436569260821/10/000678318001?17=261024&16=261021&3103=000459&3922=00826&8005=001800';
const MUESLI = '3229820129488';
const COCA_COLA = '5449000000996';

test.describe('peso y precio del producto', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
  });

  async function scanCode(page, code) {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(code);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
  }

  test('peso y precio se marcan como opcionales y sin texto de ayuda, a la misma altura', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const form = page.locator('.modal-pantalla');
    await expect(form.getByLabel('Peso (g) (opcional)')).toBeVisible();
    await expect(form.getByLabel('Precio (€) (opcional)')).toBeVisible();
    await expect(form.getByText('Peso neto del envase')).toHaveCount(0);
  });

  test('una etiqueta QR con peso y precio en el enlace rellena los dos campos y se guardan', async ({ page }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('no-encontrado').cuerpo),
    }));
    await page.route('https://prices.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [] }),
    }));
    await scanCode(page, MERCADONA);
    const form = page.locator('.modal-pantalla');
    await expect(form.getByLabel('Peso (g)')).toHaveValue('459');
    await expect(form.getByLabel('Precio (€)')).toHaveValue('8.26');
    await form.getByLabel('Producto').fill('Jamón cocido');
    await form.getByLabel('Unidades').fill('1');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'Jamón cocido' }).click();
    await page.getByRole('dialog', { name: 'Jamón cocido' }).getByRole('button', { name: 'Editar producto' }).click();
    await expect(page.getByLabel('Peso (g)')).toHaveValue('459');
    await expect(page.getByLabel('Precio (€)')).toHaveValue('8.26');
  });

  test('un código de barras trae el precio de Open Prices y el peso se escribe a mano', async ({ page }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
    await page.route('https://prices.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [{ price: 1.99 }] }),
    }));
    await scanCode(page, MUESLI);
    const form = page.locator('.modal-pantalla');
    await expect(form.getByLabel('Precio (€)')).toHaveValue('1.99');
    await expect(form.getByLabel('Peso (g)')).toHaveValue('');
    await form.getByLabel('Peso (g)').fill('375');
    await form.getByLabel('Caducidad').fill('2027-03-01');
    await form.getByLabel('Unidades').fill('1');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'muesli raisin,datte,figue' }).click();
    await page.getByRole('dialog', { name: 'muesli raisin,datte,figue' }).getByRole('button', { name: 'Editar producto' }).click();
    await expect(page.getByLabel('Peso (g)')).toHaveValue('375');
    await expect(page.getByLabel('Precio (€)')).toHaveValue('1.99');
  });

  test('una bebida pide el volumen en ml, no el peso, y lo trae de Open Food Facts', async ({ page }) => {
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-coca-cola').cuerpo),
    }));
    await page.route('https://prices.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [] }),
    }));
    await scanCode(page, COCA_COLA);
    const form = page.locator('.modal-pantalla');
    await expect(form.getByLabel('Volumen (ml)')).toHaveValue('330');
    await expect(form.getByLabel('Peso (g)')).toHaveCount(0);
    await form.getByLabel('Caducidad').fill('2027-03-01');
    await form.getByLabel('Unidades').fill('1');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'Coca-Cola Original' }).click();
    await page.getByRole('dialog', { name: 'Coca-Cola Original' }).getByRole('button', { name: 'Editar producto' }).click();
    await expect(page.getByLabel('Volumen (ml)')).toHaveValue('330');
    await expect(page.getByLabel('Peso (g)')).toHaveCount(0);
  });

  test('tomate y salsas y aceites y condimentos piden el volumen en ml, no el peso', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const form = page.locator('.modal-pantalla');
    for (const categoria of ['tomate y salsas', 'aceites y condimentos']) {
      await form.getByLabel('Categoría').selectOption(categoria);
      await expect(form.getByLabel('Volumen (ml)')).toBeVisible();
      await expect(form.getByLabel('Peso (g)')).toHaveCount(0);
    }
    await form.getByLabel('Categoría').selectOption('pasta');
    await expect(form.getByLabel('Peso (g)')).toBeVisible();
    await expect(form.getByLabel('Volumen (ml)')).toHaveCount(0);
  });
});
