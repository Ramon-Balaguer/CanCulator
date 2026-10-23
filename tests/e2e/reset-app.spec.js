import { test, expect } from '@playwright/test';

async function anadirProducto(page, nombre) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const modal = page.locator('.modal-pantalla');
  await modal.getByLabel('Producto').fill(nombre);
  await modal.getByLabel('Caducidad').fill('2027-06-01');
  await modal.getByLabel('Unidades').fill('2');
  await modal.getByRole('button', { name: 'Guardar lote' }).click();
}

async function abrirReinicio(page) {
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  await page.getByRole('button', { name: 'Resetear la app' }).click();
  const texto = await page.getByText(/¿Cuánto es \d \+ \d\?/).textContent();
  const [, a, b] = texto.match(/(\d) \+ (\d)/);
  return Number(a) + Number(b);
}

test.describe('resetear la app', () => {
  test('una suma incorrecta no exporta ni borra nada', async ({ page }) => {
    await anadirProducto(page, 'Garbanzos que sobreviven');
    const suma = await abrirReinicio(page);
    let descargas = 0;
    page.on('download', () => { descargas++; });

    await page.getByLabel('Resultado').fill(String(suma + 1));
    await page.getByRole('button', { name: 'Borrar todo' }).click();
    await expect(page.getByText('La suma no es correcta. No se ha borrado nada.')).toBeVisible();

    await page.waitForTimeout(300);
    expect(descargas).toBe(0);
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await expect(page.locator('li', { hasText: 'Garbanzos que sobreviven' })).toBeVisible();
  });

  test('con la suma correcta exporta una copia y después borra todo', async ({ page }) => {
    await anadirProducto(page, 'Lentejas que se van');
    const suma = await abrirReinicio(page);

    await page.getByLabel('Resultado').fill(String(suma));
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Borrar todo' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.json$/);
    const { readFile } = await import('node:fs/promises');
    const copia = JSON.parse(await readFile(await descarga.path(), 'utf8'));
    expect(copia.productos.map((p) => p.nombre)).toContain('Lentejas que se van');

    await expect(page.locator('li', { hasText: 'Lentejas que se van' })).toHaveCount(0, { timeout: 15000 });
    await page.goto('./');
    await expect(page.locator('li', { hasText: 'Lentejas que se van' })).toHaveCount(0);
  });
});
