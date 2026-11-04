import { test, expect } from '@playwright/test';

async function addLot(page, producto, caducidad) {
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const modal = page.locator('.modal-pantalla');
  await modal.getByLabel('Producto').fill(producto);
  await modal.getByLabel('Caducidad').fill(caducidad);
  await modal.getByLabel('Unidades').fill('2');
  await modal.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
}

test('imprimir se ordena por caducidad o por nombre', async ({ page }) => {
  await page.goto('./');
  await addLot(page, 'Zanahoria orden', '2027-01-01');
  await addLot(page, 'Arroz orden', '2027-06-01');

  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
  const productos = page.locator('table.tabla-imprimir tbody tr td:nth-child(3)');
  await expect(productos).toHaveText(['Zanahoria orden', 'Arroz orden']);

  await page.getByLabel('Ordenar por').selectOption('nombre');
  await expect(productos).toHaveText(['Arroz orden', 'Zanahoria orden']);

  await page.getByLabel('Ordenar por').selectOption('caducidad');
  await expect(productos).toHaveText(['Zanahoria orden', 'Arroz orden']);
});

test('stock se filtra por nombre sin distinguir mayúsculas ni acentos', async ({ page }) => {
  await page.goto('./');
  await addLot(page, 'Garbanzos filtro', '2027-02-01');
  await addLot(page, 'Judías filtro', '2027-03-01');

  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
  const titulos = page.locator('ul.lista .fila-titulo');
  await expect(titulos).toHaveCount(2);

  await page.getByLabel('Buscar por nombre').fill('JUDIAS');
  await expect(titulos).toHaveText(['Judías filtro']);

  await page.getByLabel('Buscar por nombre').fill('');
  await expect(titulos).toHaveCount(2);
});
