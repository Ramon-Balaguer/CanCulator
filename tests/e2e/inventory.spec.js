import { test, expect } from '@playwright/test';
import { pngEan13, TEST_CODE } from '../fixtures/barcode.js';
import { ownServer } from './own-server.js';

// Fecha ISO a N días de hoy (la zona horaria de las pruebas es Madrid).
function insideDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
}

async function openApp(page) {
  await page.goto('./');
  await expect(page.getByRole('navigation', { name: 'Pantallas' })).toBeVisible();
}

async function newLot(page, { nombre: name, caducidad: expiry = insideDays(30), cantidad: quantity = 2, foto: photo = false }) {
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const form = page.locator('.modal-pantalla');
  await form.getByLabel('Producto').fill(name);
  await form.getByLabel('Caducidad').fill(expiry);
  await form.getByLabel('Unidades').fill(String(quantity));
  if (photo) {
    await form.getByLabel('Foto del lote (opcional)').setInputFiles({
      name: 'lata.png',
      mimeType: 'image/png',
      buffer: pngEan13(TEST_CODE, { ancho: 320, alto: 240 }),
    });
  }
  await form.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
}

test.describe('alta, consumo y orden', () => {
  test('alta de lote con foto: aparece en Caducidad con su miniatura', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Garbanzos', cantidad: 3, foto: true });
    const card = page.locator('li.tarjeta', { hasText: 'Garbanzos' });
    await expect(card).toContainText('3 ud.');
    await expect(card.locator('img.miniatura')).toBeVisible();
  });

  test('consumir 1 desde Caducidad baja la cantidad y, a 0, el lote desaparece', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Lentejas', cantidad: 2 });
    const card = page.locator('li.tarjeta', { hasText: 'Lentejas' });
    await card.getByRole('button', { name: '−1' }).click();
    await expect(card).toContainText('1 ud.');
    await card.getByRole('button', { name: '−1' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Lentejas' })).toHaveCount(0);
    await expect(page.getByText('No hay comida registrada')).toBeVisible();
  });

  test('el lote que caduca antes va primero en Caducidad', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Tomate', caducidad: insideDays(200), cantidad: 1 });
    await newLot(page, { nombre: 'Atún', caducidad: insideDays(10), cantidad: 1 });
    // Espera a que la lista se actualice (reintenta) en vez de leerla al instante.
    await expect(page.locator('li.tarjeta strong')).toHaveText(['Atún', 'Tomate']);
  });

  test('caducidad pronto y caducado llevan su clase de resaltado', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Yogur', caducidad: insideDays(-2), cantidad: 1 });
    await newLot(page, { nombre: 'Pasta', caducidad: insideDays(45), cantidad: 1 });
    await newLot(page, { nombre: 'Arroz', caducidad: insideDays(400), cantidad: 1 });
    await expect(page.locator('li.tarjeta', { hasText: 'Yogur' })).toHaveClass(/estado-caducado/);
    await expect(page.locator('li.tarjeta', { hasText: 'Pasta' })).toHaveClass(/estado-pronto/);
    await expect(page.locator('li.tarjeta', { hasText: 'Arroz' })).toHaveClass(/estado-ok/);
  });

  test('consumir desde el detalle de un producto, eligiendo lote', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Judías', cantidad: 4 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'Judías' }).click();
    const modal = page.getByRole('dialog', { name: 'Judías' });
    await modal.getByRole('spinbutton', { name: 'Unidades' }).fill('3');
    await modal.getByRole('button', { name: 'Consumir' }).click();
    await expect(modal.locator('.lote-datos')).toContainText('1 ud.');
  });
});

test.describe('stock, reponer e imprimir', () => {
  test('Stock: filtra por categoría y muestra el total', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Lentejas', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await expect(page.locator('button.fila-boton', { hasText: 'Lentejas' })).toContainText('2 ud.');
    await page.getByLabel('Categoría').selectOption('pescado');
    await expect(page.getByText('Ningún producto con estos filtros.')).toBeVisible();
  });

  test('A reponer: aparece bajo el mínimo y «Comprado» abre el alta con el producto', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Atún', cantidad: 1 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'Atún' }).click();
    await page.getByRole('dialog', { name: 'Atún' }).getByRole('button', { name: 'Editar producto' }).click();
    await page.getByLabel('Stock mínimo').fill('4');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    // Tras guardar se vuelve al detalle del producto; se cierra antes de cambiar de pantalla.
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'A reponer' }).click();
    const row = page.locator('.tarjeta', { hasText: 'Atún' });
    await expect(row).toContainText('faltan 3');
    await row.getByRole('button', { name: 'Comprado' }).click();
    await expect(page.locator('.modal-pantalla').getByLabel('Producto')).toHaveValue('Atún');
  });

  test('Imprimir: en print oculta la navegación y muestra la tabla con ID corto', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Melocotón', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.barra')).toBeHidden();
    await expect(page.locator('.no-imprimir')).toBeHidden();
    const table = page.locator('table.tabla-imprimir');
    await expect(table).toBeVisible();
    const firstCell = await table.locator('tbody tr').first().locator('td').nth(1).textContent();
    expect(firstCell).toHaveLength(6);
    await expect(table).toContainText('Melocotón');
    await page.emulateMedia({ media: 'screen' });
  });

  test('datos tras recargar', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Sardinas', cantidad: 5 });
    await page.reload();
    await expect(page.locator('li.tarjeta', { hasText: 'Sardinas' })).toContainText('5 ud.');
  });
});

test.describe('copia JSON y modo sin conexión', () => {
  test('exportar JSON descarga un fichero con los datos', async ({ page }) => {
    await openApp(page);
    await newLot(page, { nombre: 'Mejillones', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar JSON' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.json$/);
    const route = await descarga.path();
    const { readFile } = await import('node:fs/promises');
    const backup = JSON.parse(await readFile(route, 'utf8'));
    expect(backup.formato).toBe('inventario-casa');
    expect(backup.lotes.map((l) => l.cantidad)).toEqual([2]);
    expect(backup.productos[0].nombre).toBe('Mejillones');
  });

  test('importar una copia añade los datos que faltan', async ({ page }) => {
    await openApp(page);
    const backup = {
      formato: 'inventario-casa',
      version: 1,
      productos: [{ id: 'p-importado', nombre: 'Garbanzos de la copia', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, actualizado: '2026-10-01T00:00:00Z', borrado: false }],
      lotes: [{ id: 'l-importado', producto_id: 'p-importado', cantidad: 7, caducidad: insideDays(60), ubicacion: 'Despensa', observaciones: '', foto_id: '', revisar: 'no', actualizado: '2026-10-01T00:00:00Z', borrado: false }],
      configuracion: [],
      fotos: [],
    };
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'copia.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.getByText(/Importado: 1 productos y 1 lotes/)).toBeVisible();
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos de la copia' })).toContainText('7 ud.');
  });

  test('sin conexión: tras cortar la red, los datos siguen visibles', async ({ page }) => {
    const server = await ownServer();
    try {
      await page.goto(server.url);
      await waitForServiceWorker(page);
      await expect(page.getByRole('navigation', { name: 'Pantallas' })).toBeVisible();
      await newLot(page, { nombre: 'Pimientos', cantidad: 6 });
      await server.cortar();
      await page.reload();
      await expect(page.locator('li.tarjeta', { hasText: 'Pimientos' })).toContainText('6 ud.', { timeout: 20_000 });
    } finally {
      await server.cortar();
    }
  });
});
