import { test, expect } from '@playwright/test';
import { abrirAjustes, crearMain, entrarComoCliente } from './sincronizacion.js';

// Sincronización directa entre dos móviles por WebRTC. Usa el servicio público de señalización
// de PeerJS, así que necesita internet.
test('una categoría añadida en un móvil aparece en el otro por la sala', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: el WebKit de Playwright no conecta las salas en este entorno; se prueba en iPhone real.');
  test.setTimeout(150_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const movilA = await a.newPage();
  const movilB = await b.newPage();
  try {
    // El móvil A crea el main con la password; el móvil B entra como cliente con el código.
    await abrirAjustes(movilA);
    const codigo = await crearMain(movilA);
    await abrirAjustes(movilB);
    await entrarComoCliente(movilB, codigo);
    await expect(movilB.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El móvil A añade una categoría.
    const categorias = movilA.locator('.bloque', { has: movilA.getByRole('heading', { name: 'Categorías' }) });
    await categorias.getByLabel('Nueva categorías').fill('Snacks por sala');
    await categorias.getByRole('button', { name: 'Añadir' }).click();
    await expect(categorias.getByText('Snacks por sala')).toBeVisible();

    // La categoría llega al móvil B.
    const categoriasB = movilB.locator('.bloque', { has: movilB.getByRole('heading', { name: 'Categorías' }) });
    await expect(categoriasB.getByText('Snacks por sala')).toBeVisible({ timeout: 60_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
