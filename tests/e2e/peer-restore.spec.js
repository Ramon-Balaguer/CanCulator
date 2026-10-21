import { test, expect } from '@playwright/test';

// La sala se guarda: si el anfitrión recarga la app, la vuelve a abrir con el mismo código y el
// invitado reconecta solo. Usa el servicio público de señalización de PeerJS (necesita internet).
test('tras recargar, el anfitrión reabre la sala y el invitado reconecta', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: solo Chromium en este entorno.');
  test.setTimeout(240_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const anfitrion = await a.newPage();
  const invitado = await b.newPage();
  try {
    for (const p of [anfitrion, invitado]) {
      await p.goto('./');
      await p.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
      await p.getByLabel('Token').fill('token-de-prueba');
      await p.getByRole('button', { name: 'Guardar', exact: true }).last().click();
    }
    await anfitrion.getByRole('button', { name: 'Crear sala' }).click();
    const codigo = await anfitrion.getByTestId('codigo-sala').textContent();
    await invitado.getByLabel('Código de la sala').fill(codigo);
    await invitado.getByRole('button', { name: 'Unirse' }).click();
    await expect(invitado.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El anfitrión recarga la app: la sala debe reabrirse sola con el mismo código.
    await anfitrion.reload();
    await anfitrion.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await expect(anfitrion.getByTestId('codigo-sala')).toHaveText(codigo, { timeout: 60_000 });
    // El invitado reconecta sin escribir nada.
    await expect(invitado.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 120_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
