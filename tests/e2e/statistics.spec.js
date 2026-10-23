import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

test.describe('estadísticas del stock', () => {
  test.use({ serviceWorkers: 'block' });

  test('unidades y calorías en total y por categoría, con aviso de productos sin datos', async ({ page }) => {
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
    // Scanned muesli (2 units, with calories from OFF).
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

    // Lentejas without a code (2 units, no calories).
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const lentils = page.locator('.modal-pantalla');
    await lentils.getByLabel('Producto').fill('Lentejas sin código');
    await lentils.getByLabel('Caducidad').fill('2027-03-01');
    await lentils.getByLabel('Unidades').fill('2');
    await lentils.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Estadísticas' }).click();
    await expect(page.getByTestId('unidades-total')).toHaveText('4');
    await expect(page.getByTestId('kcal-total')).toHaveText('2.640 kcal');
    await expect(page.getByTestId('estadisticas')).toContainText('faltan datos de 1 producto');
    await expect(page.getByTestId('estadisticas').locator('tbody tr').first()).toContainText('2.640');
  });

  test('peso, litros y coste en total y por categoría', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
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

    await page.goto('./');
    // Lentejas por peso: 2 unidades de 500 g a 2,50 €.
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const lentils = page.locator('.modal-pantalla');
    await lentils.getByLabel('Producto').fill('Lentejas');
    await lentils.getByLabel('Peso (g)').fill('500');
    await lentils.getByLabel('Precio (€)').fill('2.5');
    await lentils.getByLabel('Caducidad').fill('2027-03-01');
    await lentils.getByLabel('Unidades').fill('2');
    await lentils.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    // Coca-Cola por volumen: 3 unidades de 330 ml (de Open Food Facts) a 1 €.
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const scanner = page.getByRole('dialog', { name: 'Escanear código' });
    await scanner.getByLabel('O escribe el código').fill('5449000000996');
    await scanner.getByRole('button', { name: 'Usar este código' }).click();
    const cola = page.locator('.modal-pantalla');
    await cola.getByLabel('Precio (€)').fill('1');
    await cola.getByLabel('Caducidad').fill('2027-03-01');
    await cola.getByLabel('Unidades').fill('3');
    await cola.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Estadísticas' }).click();
    await expect(page.getByTestId('peso-total')).toHaveText('1.000 g');
    await expect(page.getByTestId('litros-total')).toHaveText('0,99 l');
    await expect(page.getByTestId('coste-total')).toHaveText('8,00 €');
    const filas = page.getByTestId('estadisticas').locator('tbody tr');
    await expect(filas.filter({ hasText: 'legumbres' })).toContainText('1.000');
    await expect(filas.filter({ hasText: 'agua y bebidas' })).toContainText('0,99');
  });
});
