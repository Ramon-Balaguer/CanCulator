import { test, expect } from '@playwright/test';

function dentroDeDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

test('editar un lote fija la cantidad que se escribe (recuento)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill('Garbanzos recuento');
  await alta.getByLabel('Caducidad').fill(dentroDeDias(60));
  await alta.getByLabel('Unidades').fill('5');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);

  const tarjeta = page.locator('li.tarjeta', { hasText: 'Garbanzos recuento' });
  await expect(tarjeta).toContainText('5 ud.');

  // Recuento: en la estantería hay 3, no 4.
  await tarjeta.getByRole('button', { name: 'Editar' }).click();
  const edicion = page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ });
  await edicion.getByLabel('Cantidad').fill('3');
  await edicion.getByRole('button', { name: 'Guardar' }).click();
  await expect(tarjeta).toContainText('3 ud.');

  // Recuento a cero: el lote deja de verse en Caducidad, pero sigue existiendo.
  await tarjeta.getByRole('button', { name: 'Editar' }).click();
  await page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ }).getByLabel('Cantidad').fill('0');
  await page.getByRole('dialog', { name: /Editar lote de Garbanzos recuento/ }).getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos recuento' })).toHaveCount(0);

  // Y en Stock el producto aparece con 0 unidades.
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  await expect(page.locator('button.fila-boton', { hasText: 'Garbanzos recuento' })).toContainText('0 ud.');
});
