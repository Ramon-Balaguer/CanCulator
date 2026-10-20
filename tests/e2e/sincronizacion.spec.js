import { test, expect } from '@playwright/test';
import { iniciarHojaFalsa } from './hoja-falsa.js';
import { servidorPropio } from './servidor-propio.js';

// Dos móviles = dos contextos de navegador independientes (cada uno con su propia IndexedDB).
test.describe('sincronización entre dos móviles', () => {
  // Dos móviles, configuración, varias sincronizaciones: más margen que el de por defecto.
  test.setTimeout(120_000);

  let hoja;
  let app;

  test.beforeEach(async () => {
    hoja = await iniciarHojaFalsa();
    app = await servidorPropio();
  });

  test.afterEach(async () => {
    await app?.cortar();
    await hoja?.cerrar();
  });

  async function configurar(page) {
    await page.goto(app.url);
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByLabel('URL de Apps Script').fill(hoja.url);
    await page.getByLabel('Token').fill(hoja.token);
    await page.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    await expect(page.getByTestId('estado-sync')).toContainText('Sincronizado', { timeout: 20_000 });
  }

  // Espera a que el servidor confirme: las operaciones pendientes deben quedar en 0.
  // (El texto "Sincronizado" de una sincronización anterior seguiría visible y no sirve de señal.)
  async function sincronizar(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await expect(page.getByTestId('pendientes-sync')).toHaveText('0', { timeout: 20_000 });
    await expect(page.getByTestId('estado-sync')).toContainText('Sincronizado');
  }

  async function ajustes(page) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  }

  async function ver(page, pantalla) {
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: pantalla }).click();
  }

  async function altaLote(page, { nombre, cantidad, caducidad }) {
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const f = page.locator('.modal-pantalla');
    await f.getByLabel('Producto').fill(nombre);
    await f.getByLabel('Caducidad').fill(caducidad);
    await f.getByLabel('Unidades').fill(String(cantidad));
    await f.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);
  }

  test('dos móviles consumen el mismo lote sin conexión y el total cuadra', async ({ browser }) => {
    const contextoA = await browser.newContext();
    const contextoB = await browser.newContext();
    const movilA = await contextoA.newPage();
    const movilB = await contextoB.newPage();
    try {
      // 1) Móvil A da de alta el lote y sincroniza; B se configura y recibe el lote.
      await configurar(movilA);
      await ver(movilA, 'Caducidad');
      await altaLote(movilA, { nombre: 'Lentejas', cantidad: 5, caducidad: '2027-03-01' });
      await sincronizar(movilA);

      await configurar(movilB);
      await ver(movilB, 'Caducidad');
      await expect(movilB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('5 ud.', { timeout: 20_000 });

      // 2) Ambos sin conexión: cada uno consume del mismo lote.
      await contextoA.setOffline(true);
      await contextoB.setOffline(true);
      await ver(movilA, 'Caducidad');
      await movilA.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await ver(movilB, 'Caducidad');
      await movilB.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await movilB.locator('li.tarjeta', { hasText: 'Lentejas' }).getByRole('button', { name: '−1' }).click();
      await expect(movilA.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('4 ud.');
      await expect(movilB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('3 ud.');

      // 3) Vuelve la conexión: los dos sincronizan y el total cuadra (5 − 1 − 2 = 2).
      await contextoA.setOffline(false);
      await contextoB.setOffline(false);
      await sincronizar(movilA);
      await sincronizar(movilB);
      await sincronizar(movilA);

      await ver(movilA, 'Caducidad');
      await ver(movilB, 'Caducidad');
      await expect(movilA.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('2 ud.');
      await expect(movilB.locator('li.tarjeta', { hasText: 'Lentejas' })).toContainText('2 ud.');

      // La hoja tiene exactamente ese total, y ninguna operación se quedó sin enviar.
      const filasLotes = hoja.hojas.get('Lotes').filas.slice(1);
      expect(filasLotes.map((r) => r[2])).toEqual(['2']);
      // Ninguna operación se quedó sin enviar en ninguno de los dos móviles.
      for (const movil of [movilA, movilB]) {
        await ajustes(movil);
        await expect(movil.getByTestId('pendientes-sync')).toHaveText('0');
      }
    } finally {
      await contextoA.close();
      await contextoB.close();
    }
  });

  test('la foto de un lote llega a la carpeta de Drive y el lote guarda su id', async ({ page }) => {
    const { pngEan13 } = await import('../fixtures/codigo-barras.js');
    await configurar(page);
    await ver(page, 'Caducidad');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    const f = page.locator('.modal-pantalla');
    await f.getByLabel('Producto').fill('Garbanzos con foto');
    await f.getByLabel('Caducidad').fill('2027-03-01');
    await f.getByLabel('Foto del lote (opcional)').setInputFiles({ name: 'g.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
    await f.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);

    await sincronizar(page);
    await sincronizar(page);

    const carpeta = hoja.ficheros.get('inventario-fotos') ?? [];
    expect(carpeta.length).toBe(1);
    const lotes = hoja.hojas.get('Lotes');
    const filaFoto = lotes.filas.find((r) => r[6] && r[6] === carpeta[0].getId());
    expect(filaFoto).toBeTruthy();
  });
});
