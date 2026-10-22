import { test, expect } from '@playwright/test';
import { pngEan13 } from '../fixtures/barcode.js';
import { abrirAjustes, crearMain, entrarComoCliente } from './sincronizacion.js';

// Con la sala abierta, la foto de un lote llega al otro móvil con el lote.
test('la foto de un lote llega al otro móvil por la sala', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: solo Chromium en este entorno.');
  test.setTimeout(180_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const anfitrion = await a.newPage();
  const invitado = await b.newPage();
  try {
    await abrirAjustes(anfitrion);
    const codigo = await crearMain(anfitrion);
    await abrirAjustes(invitado);
    await entrarComoCliente(invitado, codigo);
    await expect(invitado.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });
    await expect(anfitrion.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    await anfitrion.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await anfitrion.getByRole('button', { name: 'Añadir lote' }).click();
    const alta = anfitrion.locator('.modal-pantalla');
    await alta.getByLabel('Producto').fill('Lentejas con foto');
    await alta.getByLabel('Caducidad').fill('2027-09-01');
    await alta.getByLabel('Unidades').fill('2');
    await alta.getByLabel('Foto (opcional)').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: pngEan13('2012345678903', { ancho: 200, alto: 150 }) });
    await alta.getByRole('button', { name: 'Guardar lote' }).click();

    await invitado.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    const tarjeta = invitado.locator('li.tarjeta', { hasText: 'Lentejas con foto' });
    await expect(tarjeta).toContainText('2 ud.', { timeout: 60_000 });
    await expect(tarjeta.locator('img.miniatura')).toHaveAttribute('src', /^blob:/, { timeout: 60_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
