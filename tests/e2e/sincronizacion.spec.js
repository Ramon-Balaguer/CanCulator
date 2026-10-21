import { test, expect } from '@playwright/test';
import { startFakeSheet } from './hoja-falsa.js';
import { ownServer } from './servidor-propio.js';

// Dos móviles = dos contextos de navegador independientes (cada uno con su propia IndexedDB).
test.describe('sincronización entre dos móviles', () => {
  // Dos móviles, configuración, varias sincronizaciones: más margen que el de por defecto.
  test.setTimeout(120_000);

  let sheet;
  let app;

  test.beforeEach(async () => {
    sheet = await startFakeSheet();
    app = await ownServer();
  });

  test.afterEach(async () => {
    await app?.cortar();
    await sheet?.cerrar();
  });

  async function configure(page) {
    await page.goto(app.url);
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('URL de Apps Script').fill(sheet.url);
    await page.getByLabel('Token').fill(sheet.token);
    await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    await expect(page.getByTestId('estado-sync')).toContainText('Sincronizado', { timeout: 20_000 });
  }

  // Espera a que el servidor confirme: las operaciones pendientes deben quedar en 0.
  // (El texto "Sincronizado" de una sincronización anterior seguiría visible y no sirve de señal.)
  async function sync(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
    await expect(page.getByTestId('estado-sync')).toContainText('Sincronizado');
  }

  async function settings(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  }

  async function view(page, screen) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: screen }).click();
  }

  async function addLot(page, { nombre: name, cantidad: quantity, caducidad: expiry }) {
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const f = page.locator('.modal-pantalla');
    await f.getByLabel('Producto').fill(name);
    await f.getByLabel('Caducidad').fill(expiry);
    await f.getByLabel('Unidades').fill(String(quantity));
    await f.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);
  }

  test('dos móviles consumen el mismo lote sin conexión y el total cuadra', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const phoneA = await contextA.newPage();
    const phoneB = await contextB.newPage();
    try {
      // 1) Móvil A da de alta el lote y sincroniza; B se configura y recibe el lote.
      await configure(phoneA);
      await view(phoneA, 'Caducidad');
      await addLot(phoneA, { nombre: 'Lentejas', cantidad: 5, caducidad: '2027-03-01' });
      await sync(phoneA);

      await configure(phoneB);
      await view(phoneB, 'Caducidad');
      await expect(phoneB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('5 ud.', { timeout: 20_000 });

      // 2) Ambos sin conexión: cada uno consume del mismo lote.
      await contextA.setOffline(true);
      await contextB.setOffline(true);
      await view(phoneA, 'Caducidad');
      await phoneA.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await view(phoneB, 'Caducidad');
      await phoneB.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await phoneB.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await expect(phoneA.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('4 ud.');
      await expect(phoneB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('3 ud.');

      // 3) Vuelve la conexión: los dos sincronizan y el total cuadra (5 − 1 − 2 = 2).
      await contextA.setOffline(false);
      await contextB.setOffline(false);
      await sync(phoneA);
      await sync(phoneB);
      await sync(phoneA);

      await view(phoneA, 'Caducidad');
      await view(phoneB, 'Caducidad');
      await expect(phoneA.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('2 ud.');
      await expect(phoneB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('2 ud.');

      // La hoja tiene exactamente ese total, y ninguna operación se quedó sin enviar.
      const lotRows = sheet.hojas.get('Lotes').filas.slice(1);
      expect(lotRows.map((r) => r[2])).toEqual(['2']);
      // Ninguna operación se quedó sin enviar en ninguno de los dos móviles.
      for (const phone of [phoneA, phoneB]) {
        await settings(phone);
        await expect(phone.getByTestId('pendientes-sync')).toHaveText('0');
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('la foto de un lote llega a la carpeta de Drive y el lote guarda su id', async ({ page }) => {
    const { pngEan13 } = await import('../fixtures/codigo-barras.js');
    await configure(page);
    await view(page, 'Caducidad');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const f = page.locator('.modal-pantalla');
    await f.getByLabel('Producto').fill('Garbanzos con foto');
    await f.getByLabel('Caducidad').fill('2027-03-01');
    await f.getByLabel('Foto del lote (opcional)').setInputFiles({ name: 'g.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
    await f.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await sync(page);
    await sync(page);

    const folder = sheet.ficheros.get('inventario-fotos') ?? [];
    expect(folder.length).toBe(1);
    const lots = sheet.hojas.get('Lotes');
    const photoRow = lots.filas.find((r) => r[6] && r[6] === folder[0].getId());
    expect(photoRow).toBeTruthy();
  });
});
