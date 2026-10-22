import { test, expect } from '@playwright/test';
import { abrirAjustes, crearMain, entrarComoCliente } from './sincronizacion.js';

// Sincronización directa entre dos móviles por WebRTC. Usa el servicio público de señalización
// de PeerJS, así que necesita internet.
test('un lote añadido en un móvil aparece en el otro por la sala', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: el WebKit de Playwright no conecta las salas en este entorno; se prueba en iPhone real.');
  test.setTimeout(150_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const movilA = await a.newPage();
  const movilB = await b.newPage();
  try {
    await movilA.goto('./');
    await movilB.goto('./');

    // El móvil A añade un lote y crea la sala.
    await movilA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await movilA.getByRole('button', { name: 'Añadir lote' }).click();
    const alta = movilA.locator('.modal-pantalla');
    await alta.getByLabel('Producto').fill('Pasta por sala');
    await alta.getByLabel('Caducidad').fill('2027-05-01');
    await alta.getByLabel('Unidades').fill('4');
    await alta.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(movilA.locator('.modal-pantalla')).toHaveCount(0);

    // El móvil A crea el main con la password; el móvil B entra como cliente con el código.
    await abrirAjustes(movilA);
    const codigo = await crearMain(movilA);
    await abrirAjustes(movilB);
    await entrarComoCliente(movilB, codigo);
    await expect(movilB.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El lote llega al móvil B.
    await movilB.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(movilB.locator('li.tarjeta', { hasText: 'Pasta por sala' })).toContainText('4 ud.', { timeout: 60_000 });
  } finally {
    await a.close();
    await b.close();
  }
});

// Un registro que solo tiene un móvil (sin operación que lo haya llevado al otro) debe llegar al conectar.
test('un lote sin operación en el móvil B llega al móvil A con la sincronización completa', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: el WebKit de Playwright no conecta las salas en este entorno; se prueba en iPhone real.');
  test.setTimeout(150_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const movilA = await a.newPage();
  const movilB = await b.newPage();
  try {
    await movilA.goto('./');
    await movilB.goto('./');

    // El móvil B tiene el lote en su base, pero sin la operación que lo habría enviado.
    await movilB.evaluate(async () => {
      const db = await new Promise((ok, ko) => {
        const peticion = indexedDB.open('canculator');
        peticion.onsuccess = () => ok(peticion.result);
        peticion.onerror = () => ko(peticion.error);
      });
      const tx = db.transaction(['Productos', 'Lotes'], 'readwrite');
      tx.objectStore('Productos').put({ id: 'p-snapshot', nombre: 'Lenteja sin operación', categoria: 'legumbres', codigo_barras: '', stock_minimo: 0, actualizado: '2026-10-20T10:00:00Z', borrado: false });
      tx.objectStore('Lotes').put({ id: 'l-snapshot', producto_id: 'p-snapshot', cantidad: 7, caducidad: '2027-05-01', ubicacion: 'Despensa', observaciones: '', foto_id: '', revisar: 'no', actualizado: '2026-10-20T10:00:00Z', borrado: false });
      await new Promise((ok, ko) => {
        tx.oncomplete = ok;
        tx.onerror = () => ko(tx.error);
      });
      db.close();
    });

    await abrirAjustes(movilA);
    const codigo = await crearMain(movilA);
    await abrirAjustes(movilB);
    await entrarComoCliente(movilB, codigo);
    await expect(movilB.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El lote que solo tenía B aparece en A.
    await movilA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(movilA.locator('li.tarjeta', { hasText: 'Lenteja sin operación' })).toContainText('7 ud.', { timeout: 60_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
