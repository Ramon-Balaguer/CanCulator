import { test, expect } from '@playwright/test';

// Sincronización directa entre dos móviles por WebRTC. Usa el servicio público de señalización
// de PeerJS, así que necesita internet. No usa Apps Script.
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

    // Mismo token en los dos móviles.
    for (const movil of [movilA, movilB]) {
      await movil.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
      await movil.getByLabel('Token').fill('token-de-prueba');
      await movil.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    }

    // El móvil A añade un lote y crea la sala.
    await movilA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await movilA.getByRole('button', { name: 'Añadir lote' }).click();
    const alta = movilA.locator('.modal-pantalla');
    await alta.getByLabel('Producto').fill('Pasta por sala');
    await alta.getByLabel('Caducidad').fill('2027-05-01');
    await alta.getByLabel('Unidades').fill('4');
    await alta.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(movilA.locator('.modal-pantalla')).toHaveCount(0);

    await movilA.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await movilA.getByRole('button', { name: 'Crear sala' }).click();
    const codigo = await movilA.getByTestId('codigo-sala').textContent();

    // El móvil B se une con el código.
    await movilB.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await movilB.getByLabel('Código de la sala').fill(codigo);
    await movilB.getByRole('button', { name: 'Unirse' }).click();
    await expect(movilB.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El lote llega al móvil B.
    await movilB.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(movilB.locator('li.tarjeta', { hasText: 'Pasta por sala' })).toContainText('4 ud.', { timeout: 60_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
