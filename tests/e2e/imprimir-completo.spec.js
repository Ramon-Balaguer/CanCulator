import { test, expect } from '@playwright/test';
import { pngEan13 } from '../fixtures/codigo-barras.js';

const CODE = '3229820129488';

test('imprimir incluye la foto del lote y el código de barras del producto', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill('Muesli imprimible');
  await newLotTest.getByLabel('Caducidad').fill('2027-04-01');
  await newLotTest.getByLabel('Unidades').fill('2');
  await newLotTest.getByLabel('Foto del lote (opcional)').setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  // Código de barras del producto: se pone en Editar producto.
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  await page.locator('button.fila-boton', { hasText: 'Muesli imprimible' }).click();
  await page.getByRole('dialog', { name: 'Muesli imprimible' }).getByRole('button', { name: 'Editar producto' }).click();
  await page.getByLabel('Código de barras').fill(CODE);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
  const row = page.locator('table.tabla-imprimir tbody tr', { hasText: 'Muesli imprimible' });
  await expect(row.locator('svg.codigo-barras')).toBeVisible();
  await expect(row.locator('svg.codigo-barras text')).toHaveText(CODE);
  await expect(row.locator('img.miniatura')).toBeVisible();
});
