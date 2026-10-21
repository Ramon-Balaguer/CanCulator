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
    // Muesli escaneado (2 ud., con calorías de OFF).
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

    // Lentejas sin código (2 ud., sin calorías).
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const lentils = page.locator('.modal-pantalla');
    await lentils.getByLabel('Producto').fill('Lentejas sin código');
    await lentils.getByLabel('Caducidad').fill('2027-03-01');
    await lentils.getByLabel('Unidades').fill('2');
    await lentils.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Estadísticas' }).click();
    await expect(page.getByTestId('unidades-total')).toHaveText('4');
    await expect(page.getByTestId('kcal-total')).toHaveText('2640 kcal');
    await expect(page.getByTestId('estadisticas')).toContainText('faltan datos de 1 producto');
    await expect(page.getByTestId('estadisticas').locator('tbody tr').first()).toContainText('2640');
  });
});
