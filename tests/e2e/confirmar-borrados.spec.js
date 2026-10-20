import { test, expect } from '@playwright/test';

test('borrar un lote pide confirmación: «No» lo conserva, «Sí» lo quita', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill('Borrar con confirmación');
  await alta.getByLabel('Caducidad').fill('2027-06-01');
  await alta.getByLabel('Unidades').fill('2');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();

  const tarjeta = page.locator('li.tarjeta', { hasText: 'Borrar con confirmación' });
  await tarjeta.getByRole('button', { name: 'Editar' }).click();
  const edicion = page.getByRole('dialog', { name: /Editar lote de Borrar con confirmación/ });

  await edicion.getByRole('button', { name: 'Borrar lote' }).click();
  await expect(edicion.getByText('¿Seguro? Se quitará este lote.')).toBeVisible();
  await edicion.getByRole('button', { name: 'No', exact: true }).click();
  await expect(edicion.getByRole('button', { name: 'Borrar lote' })).toBeVisible();

  await edicion.getByRole('button', { name: 'Borrar lote' }).click();
  await edicion.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('li.tarjeta', { hasText: 'Borrar con confirmación' })).toHaveCount(0);
});

test('quitar una categoría pide confirmación en el navegador', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  const chip = page.locator('li.chip', { hasText: 'otros' });
  await expect(chip).toBeVisible();

  page.once('dialog', (dialogo) => dialogo.dismiss());
  await chip.getByRole('button', { name: 'Quitar otros' }).click();
  await expect(chip).toBeVisible();

  page.once('dialog', (dialogo) => dialogo.accept());
  await chip.getByRole('button', { name: 'Quitar otros' }).click();
  await expect(page.locator('li.chip', { hasText: 'otros' })).toHaveCount(0);
});
