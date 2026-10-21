import { test, expect } from '@playwright/test';

function insideDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

test('editar un lote fija la cantidad que se escribe (recuento)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill('Garbanzos recuento');
  await newLotTest.getByLabel('Caducidad').fill(insideDays(60));
  await newLotTest.getByLabel('Unidades').fill('5');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  const card = page.locator('li.tarjeta', { hasText: 'Garbanzos recuento' });
  await expect(card).toContainText('5 ud.');

  // Recuento: en la estantería hay 3, no 4.
  await card.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ });
  await edit.getByLabel('Cantidad').fill('3');
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(card).toContainText('3 ud.');

  // Recuento a cero: el lote deja de verse en Caducidad, pero sigue existiendo.
  await card.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ }).getByLabel('Cantidad').fill('0');
  await page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ }).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos recuento' })).toHaveCount(0);

  // Y en Stock el producto aparece con 0 unidades.
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  await expect(page.locator('button.fila-boton', { hasText: 'Garbanzos recuento' })).toContainText('0 ud.');
});
