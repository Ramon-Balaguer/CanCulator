import { test, expect } from '@playwright/test';
import { pngEan13, CODIGO_PRUEBA } from '../fixtures/codigo-barras.js';
import { servidorPropio } from './servidor-propio.js';

// Fecha ISO a N días de hoy (la zona horaria de las pruebas es Madrid).
function dentroDeDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

async function esperarServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
}

async function abrirApp(page) {
  await page.goto('./');
  await expect(page.getByRole('navigation', { name: 'Pantallas' })).toBeVisible();
}

async function nuevoLote(page, { nombre, caducidad = dentroDeDias(30), cantidad = 2, foto = false }) {
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  const formulario = page.locator('.modal-pantalla');
  await formulario.getByLabel('Producto').fill(nombre);
  await formulario.getByLabel('Caducidad').fill(caducidad);
  await formulario.getByLabel('Unidades').fill(String(cantidad));
  if (foto) {
    await formulario.getByLabel('Foto del lote (opcional)').setInputFiles({
      name: 'lata.png',
      mimeType: 'image/png',
      buffer: pngEan13(CODIGO_PRUEBA, { ancho: 320, alto: 240 }),
    });
  }
  await formulario.getByRole('button', { name: 'Guardar lote' }).click();
  await expect(page.locator('.modal-pantalla')).toHaveCount(0);
}

test.describe('alta, consumo y orden', () => {
  test('alta de lote con foto: aparece en Caducidad con su miniatura', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Garbanzos', cantidad: 3, foto: true });
    const tarjeta = page.locator('li.tarjeta', { hasText: 'Garbanzos' });
    await expect(tarjeta).toContainText('3 ud.');
    await expect(tarjeta.locator('img.miniatura')).toBeVisible();
  });

  test('consumir 1 desde Caducidad baja la cantidad y, a 0, el lote desaparece', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Lentejas', cantidad: 2 });
    const tarjeta = page.locator('li.tarjeta', { hasText: 'Lentejas' });
    await tarjeta.getByRole('button', { name: '−1' }).click();
    await expect(tarjeta).toContainText('1 ud.');
    await tarjeta.getByRole('button', { name: '−1' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Lentejas' })).toHaveCount(0);
    await expect(page.getByText('No hay comida registrada')).toBeVisible();
  });

  test('el lote que caduca antes va primero en Caducidad', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Tomate', caducidad: dentroDeDias(200), cantidad: 1 });
    await nuevoLote(page, { nombre: 'Atún', caducidad: dentroDeDias(10), cantidad: 1 });
    // Espera a que la lista se actualice (reintenta) en vez de leerla al instante.
    await expect(page.locator('li.tarjeta strong')).toHaveText(['Atún', 'Tomate']);
  });

  test('caducidad pronto y caducado llevan su clase de resaltado', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Yogur', caducidad: dentroDeDias(-2), cantidad: 1 });
    await nuevoLote(page, { nombre: 'Pasta', caducidad: dentroDeDias(45), cantidad: 1 });
    await nuevoLote(page, { nombre: 'Arroz', caducidad: dentroDeDias(400), cantidad: 1 });
    await expect(page.locator('li.tarjeta', { hasText: 'Yogur' })).toHaveClass(/estado-caducado/);
    await expect(page.locator('li.tarjeta', { hasText: 'Pasta' })).toHaveClass(/estado-pronto/);
    await expect(page.locator('li.tarjeta', { hasText: 'Arroz' })).toHaveClass(/estado-ok/);
  });

  test('consumir desde el detalle de un producto, eligiendo lote', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Judías', cantidad: 4 });
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
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Lentejas', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await expect(page.locator('button.fila-boton', { hasText: 'Lentejas' })).toContainText('2 ud.');
    await page.getByLabel('Categoría').selectOption('pescado');
    await expect(page.getByText('Ningún producto con estos filtros.')).toBeVisible();
  });

  test('A reponer: aparece bajo el mínimo y «Comprado» abre el alta con el producto', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Atún', cantidad: 1 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Stock' }).click();
    await page.locator('button.fila-boton', { hasText: 'Atún' }).click();
    await page.getByRole('dialog', { name: 'Atún' }).getByRole('button', { name: 'Editar producto' }).click();
    await page.getByLabel('Stock mínimo').fill('4');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    // Tras guardar se vuelve al detalle del producto; se cierra antes de cambiar de pantalla.
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click();

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'A reponer' }).click();
    const fila = page.locator('.tarjeta', { hasText: 'Atún' });
    await expect(fila).toContainText('faltan 3');
    await fila.getByRole('button', { name: 'Comprado' }).click();
    await expect(page.locator('.modal-pantalla').getByLabel('Producto')).toHaveValue('Atún');
  });

  test('Imprimir: en print oculta la navegación y muestra la tabla con ID corto', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Melocotón', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.barra')).toBeHidden();
    await expect(page.locator('.no-imprimir')).toBeHidden();
    const tabla = page.locator('table.tabla-imprimir');
    await expect(tabla).toBeVisible();
    const primeraCelda = await tabla.locator('tbody tr').first().locator('td').nth(1).textContent();
    expect(primeraCelda).toHaveLength(6);
    await expect(tabla).toContainText('Melocotón');
    await page.emulateMedia({ media: 'screen' });
  });

  test('datos tras recargar', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Sardinas', cantidad: 5 });
    await page.reload();
    await expect(page.locator('li.tarjeta', { hasText: 'Sardinas' })).toContainText('5 ud.');
  });
});

test.describe('copia JSON y modo sin conexión', () => {
  test('exportar JSON descarga un fichero con los datos', async ({ page }) => {
    await abrirApp(page);
    await nuevoLote(page, { nombre: 'Mejillones', cantidad: 2 });
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar JSON' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^inventario-\d{4}-\d{2}-\d{2}\.json$/);
    const ruta = await descarga.path();
    const { readFile } = await import('node:fs/promises');
    const copia = JSON.parse(await readFile(ruta, 'utf8'));
    expect(copia.formato).toBe('inventario-casa');
    expect(copia.lotes.map((l) => l.cantidad)).toEqual([2]);
    expect(copia.productos[0].nombre).toBe('Mejillones');
  });

  test('importar una copia añade los datos que faltan', async ({ page }) => {
    await abrirApp(page);
    const copia = {
      formato: 'inventario-casa',
      version: 1,
      productos: [{ id: 'p-importado', nombre: 'Garbanzos de la copia', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, actualizado: '2026-10-01T00:00:00Z', borrado: false }],
      lotes: [{ id: 'l-importado', producto_id: 'p-importado', cantidad: 7, caducidad: dentroDeDias(60), ubicacion: 'Despensa', observaciones: '', foto_id: '', revisar: 'no', actualizado: '2026-10-01T00:00:00Z', borrado: false }],
      configuracion: [],
      fotos: [],
    };
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'copia.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(copia)),
    });
    await expect(page.getByText(/Importado: 1 productos y 1 lotes/)).toBeVisible();
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos de la copia' })).toContainText('7 ud.');
  });

  test('sin conexión: tras cortar la red, los datos siguen visibles', async ({ page }) => {
    const servidor = await servidorPropio();
    try {
      await page.goto(servidor.url);
      await esperarServiceWorker(page);
      await expect(page.getByRole('navigation', { name: 'Pantallas' })).toBeVisible();
      await nuevoLote(page, { nombre: 'Pimientos', cantidad: 6 });
      await servidor.cortar();
      await page.reload();
      await expect(page.locator('li.tarjeta', { hasText: 'Pimientos' })).toContainText('6 ud.', { timeout: 20_000 });
    } finally {
      await servidor.cortar();
    }
  });
});
