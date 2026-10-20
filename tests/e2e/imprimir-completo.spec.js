import { test, expect } from '@playwright/test';
import { pngEan13 } from '../fixtures/codigo-barras.js';

const CODIGO = '3229820129488';

test('imprimir incluye la foto del lote y el código de barras del producto', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill('Muesli imprimible');
  await alta.getByLabel('Caducidad').fill('2027-04-01');
  await alta.getByLabel('Unidades').fill('2');
  await alta.getByLabel('Foto del lote (opcional)').setInputFiles({ name: 'm.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
  await alta.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  // Código de barras del producto: se pone en Editar producto.
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  await page.locator('button.fila-boton', { hasText: 'Muesli imprimible' }).click();
  await page.getByRole('dialog', { name: 'Muesli imprimible' }).getByRole('button', { name: 'Editar producto' }).click();
  await page.getByLabel('Código de barras').fill(CODIGO);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
  const fila = page.locator('table.tabla-imprimir tbody tr', { hasText: 'Muesli imprimible' });
  await expect(fila.locator('svg.codigo-barras')).toBeVisible();
  await expect(fila.locator('svg.codigo-barras text')).toHaveText(CODIGO);
  await expect(fila.locator('img.miniatura')).toBeVisible();
});
