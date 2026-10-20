import { test, expect } from '@playwright/test';

async function crearLote(page, nombre) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const alta = page.locator('.modal-pantalla');
  await alta.getByLabel('Producto').fill(nombre);
  await alta.getByLabel('Caducidad').fill('2027-07-01');
  await alta.getByLabel('Unidades').fill('2');
  await alta.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
}

async function borrarLoteConfirmado(page, nombre) {
  const tarjeta = page.locator('li.tarjeta', { hasText: nombre });
  await tarjeta.getByRole('button', { name: 'Editar' }).click();
  const edicion = page.getByRole('dialog', { name: new RegExp(`Editar lote de ${nombre}`) });
  await edicion.getByRole('button', { name: 'Borrar lote' }).click();
  await edicion.getByRole('button', { name: 'Sí, borrar' }).click();
}

test('tras borrar, «Deshacer» en el aviso restaura el lote', async ({ page }) => {
  await crearLote(page, 'Deshacer lote');
  await borrarLoteConfirmado(page, 'Deshacer lote');
  await expect(page.locator('li.tarjeta', { hasText: 'Deshacer lote' })).toHaveCount(0);

  const aviso = page.getByRole('status').filter({ hasText: 'Deshacer' });
  await expect(aviso).toBeVisible();
  await aviso.click();
  await expect(page.locator('li.tarjeta', { hasText: 'Deshacer lote' })).toContainText('2 ud.');
});

test('sin pulsar «Deshacer», el borrado se hace al cabo de unos segundos', async ({ page }) => {
  await crearLote(page, 'Borrado definitivo');
  await borrarLoteConfirmado(page, 'Borrado definitivo');
  await expect(page.locator('li.tarjeta', { hasText: 'Borrado definitivo' })).toHaveCount(0);
  // Pasa la ventana de deshacer: el lote sigue sin aparecer, y ya no hay aviso de deshacer.
  await page.waitForTimeout(5500);
  await page.reload();
  await expect(page.locator('li.tarjeta', { hasText: 'Borrado definitivo' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Deshacer' })).toHaveCount(0);
});
