import { test, expect } from '@playwright/test';

test('la caducidad se escribe con el teclado numérico y pone las barras solas', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  const expiry = newLotTest.getByLabel('Caducidad');

  await expect(expiry).toHaveAttribute('inputmode', 'numeric');
  await expect(expiry).toHaveAttribute('type', 'text');

  await newLotTest.getByLabel('Producto').fill('Judías teclado');
  await expiry.pressSequentially('01032027');
  await expect(expiry).toHaveValue('01/03/2027');

  await newLotTest.getByLabel('Unidades').fill('2');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
  await expect(page.locator('li.tarjeta', { hasText: 'Judías teclado' })).toContainText('01/03/2027');
});

test('una fecha imposible no se guarda y avisa', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill('Garbanzos fecha mala');
  await newLotTest.getByLabel('Caducidad').pressSequentially('31022027');
  await newLotTest.getByLabel('Unidades').fill('1');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(newLotTest.getByRole('alert')).toContainText('DD/MM/AAAA');
  await expect(page.locator('.modal-pantalla')).toHaveCount(1);
});

test('editar un lote muestra su caducidad en DD/MM/AAAA y la guarda escrita a mano', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill('Tomate teclado');
  await newLotTest.getByLabel('Caducidad').fill('2027-05-09');
  await newLotTest.getByLabel('Unidades').fill('1');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();

  const card = page.locator('li.tarjeta', { hasText: 'Tomate teclado' });
  await card.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: /Editar lote de Tomate teclado/ });
  const field = edit.getByLabel('Caducidad');
  await expect(field).toHaveValue('09/05/2027');
  await field.fill('');
  await field.pressSequentially('10062027');
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(card).toContainText('10/06/2027');
});
