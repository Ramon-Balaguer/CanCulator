import { test, expect } from '@playwright/test';

function insideDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

test('añadir un lote a un producto sólo pide ubicación, caducidad y unidades', async ({ page }) => {
  await page.goto('./');
  // A product with one lot, created the normal way (new product: all the fields).
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const primero = page.locator('.modal-pantalla');
  await primero.getByLabel('Producto').fill('Macarrones lote');
  await primero.getByLabel('Caducidad').fill(insideDays(60));
  await primero.getByLabel('Unidades').fill('1');
  await primero.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  // Adding a lot from the product: only the three lot fields are offered.
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  await page.locator('button.fila-boton', { hasText: 'Macarrones lote' }).click();
  await page.getByRole('dialog', { name: 'Macarrones lote' }).getByRole('button', { name: 'Añadir lote' }).click();

  const form = page.locator('.modal-pantalla');
  await expect(form.getByLabel('Ubicación')).toBeVisible();
  await expect(form.getByLabel('Caducidad')).toBeVisible();
  await expect(form.getByLabel('Unidades')).toBeVisible();
  await expect(form.getByLabel('Producto')).toHaveCount(0);
  await expect(form.getByLabel('Categoría')).toHaveCount(0);
  await expect(form.getByLabel('Foto (opcional)')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Escanear código' })).toHaveCount(0);

  await form.getByLabel('Caducidad').fill(insideDays(90));
  await form.getByLabel('Unidades').fill('4');
  await form.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
  await expect(page.locator('li.tarjeta', { hasText: 'Macarrones lote' })).toHaveCount(2);
});
