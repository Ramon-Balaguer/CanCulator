import { test, expect } from '@playwright/test';

test('borrar un lote pide confirmación: «No» lo conserva, «Sí» lo quita', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill('Borrar con confirmación');
  await newLotTest.getByLabel('Caducidad').fill('2027-06-01');
  await newLotTest.getByLabel('Unidades').fill('2');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();

  const card = page.locator('li.tarjeta', { hasText: 'Borrar con confirmación' });
  await card.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: /Editar lote de Borrar con confirmación/ });

  await edit.getByRole('button', { name: 'Borrar lote' }).click();
  await expect(edit.getByText('¿Seguro? Se quitará este lote.')).toBeVisible();
  await edit.getByRole('button', { name: 'No', exact: true }).click();
  await expect(edit.getByRole('button', { name: 'Borrar lote' })).toBeVisible();

  await edit.getByRole('button', { name: 'Borrar lote' }).click();
  await edit.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('li.tarjeta', { hasText: 'Borrar con confirmación' })).toHaveCount(0);
});

test('quitar una categoría pide confirmación en el navegador', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  const chip = page.locator('li.chip', { hasText: 'otros' });
  await expect(chip).toBeVisible();

  page.once('dialog', (dialog) => dialog.dismiss());
  await chip.getByRole('button', { name: 'Quitar otros' }).click();
  await expect(chip).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await chip.getByRole('button', { name: 'Quitar otros' }).click();
  await expect(page.locator('li.chip', { hasText: 'otros' })).toHaveCount(0);
});
