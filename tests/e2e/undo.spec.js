import { test, expect } from '@playwright/test';

async function createLot(page, name) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const newLotTest = page.locator('.modal-pantalla');
  await newLotTest.getByLabel('Producto').fill(name);
  await newLotTest.getByLabel('Caducidad').fill('2027-07-01');
  await newLotTest.getByLabel('Unidades').fill('2');
  await newLotTest.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
}

async function removeLotConfirmed(page, name) {
  const card = page.locator('li.tarjeta', { hasText: name });
  await card.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: new RegExp(`Editar lote de ${name}`) });
  await edit.getByRole('button', { name: 'Borrar lote' }).click();
  await edit.getByRole('button', { name: 'Sí, borrar' }).click();
}

test('tras borrar, «Deshacer» en el aviso restaura el lote', async ({ page }) => {
  await createLot(page, 'Deshacer lote');
  await removeLotConfirmed(page, 'Deshacer lote');
  await expect(page.locator('li.tarjeta', { hasText: 'Deshacer lote' })).toHaveCount(0);

  const notice = page.getByRole('status').filter({ hasText: 'Deshacer' });
  await expect(notice).toBeVisible();
  await notice.click();
  await expect(page.locator('li.tarjeta', { hasText: 'Deshacer lote' })).toContainText('2 ud.');
});

test('sin pulsar «Deshacer», el borrado se hace al cabo de unos segundos', async ({ page }) => {
  await createLot(page, 'Borrado definitivo');
  await removeLotConfirmed(page, 'Borrado definitivo');
  await expect(page.locator('li.tarjeta', { hasText: 'Borrado definitivo' })).toHaveCount(0);
  // Goes back to the Undo window: the lot still does not appear, and there is no longer an undo notice.
  await page.waitForTimeout(5500);
  await page.reload();
  await expect(page.locator('li.tarjeta', { hasText: 'Borrado definitivo' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Deshacer' })).toHaveCount(0);
});
