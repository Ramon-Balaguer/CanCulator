import { test, expect } from '@playwright/test';

test('la caducidad se escribe con el teclado numérico y pone las barras solas', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  const caducidad = alta.getByLabel('Caducidad');

  await expect(caducidad).toHaveAttribute('inputmode', 'numeric');
  await expect(caducidad).toHaveAttribute('type', 'text');

  await alta.getByLabel('Producto').fill('Judías teclado');
  await caducidad.pressSequentially('01032027');
  await expect(caducidad).toHaveValue('01/03/2027');

  await alta.getByLabel('Unidades').fill('2');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
  await expect(page.locator('li.tarjeta', { hasText: 'Judías teclado' })).toContainText('01/03/2027');
});

test('una fecha imposible no se guarda y avisa', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill('Garbanzos fecha mala');
  await alta.getByLabel('Caducidad').pressSequentially('31022027');
  await alta.getByLabel('Unidades').fill('1');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(alta.getByRole('alert')).toContainText('DD/MM/AAAA');
  await expect(page.locator('.modal-pantalla')).toHaveCount(1);
});

test('editar un lote muestra su caducidad en DD/MM/AAAA y la guarda escrita a mano', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill('Tomate teclado');
  await alta.getByLabel('Caducidad').fill('2027-05-09');
  await alta.getByLabel('Unidades').fill('1');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();

  const tarjeta = page.locator('li.tarjeta', { hasText: 'Tomate teclado' });
  await tarjeta.getByRole('button', { name: 'Editar' }).click();
  const edicion = page.getByRole('dialog', { name: /Editar lote de Tomate teclado/ });
  const campo = edicion.getByLabel('Caducidad');
  await expect(campo).toHaveValue('09/05/2027');
  await campo.fill('');
  await campo.pressSequentially('10062027');
  await edicion.getByRole('button', { name: 'Guardar' }).click();
  await expect(tarjeta).toContainText('10/06/2027');
});
