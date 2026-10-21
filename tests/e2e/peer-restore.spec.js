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
      await p.getByRole('button', { name: 'Guardar token' }).click();
    }
    await anfitrion.getByRole('button', { name: 'Crear sala' }).click();
    const codigo = await anfitrion.getByTestId('codigo-sala').textContent();
    await invitado.getByLabel('Código de la sala').fill(codigo);
    await invitado.getByRole('button', { name: 'Entrar' }).click();
    await expect(invitado.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // El anfitrión recarga la app desde otra pantalla: la sala debe reabrirse sola, sin ir a Ajustes.
    await anfitrion.reload();
    await expect(anfitrion.locator('#estado-sync')).toContainText('Conectado', { timeout: 120_000 });
    // El invitado reconecta sin escribir nada.
    await expect(invitado.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 120_000 });
    await anfitrion.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await expect(anfitrion.getByTestId('codigo-sala')).toHaveText(codigo);
  } finally {
    await a.close();
    await b.close();
  }
});

// Si el anfitrión aún no está en la sala (p. ej. recargando), el invitado no se rinde: reintenta solo.
test('el invitado reintenta si la sala aún no existe', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: solo Chromium en este entorno.');
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const invitado = await context.newPage();
  try {
    await invitado.goto('./');
    await invitado.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
    await invitado.getByLabel('Token').fill('token-de-prueba');
    await invitado.getByRole('button', { name: 'Guardar token' }).click();
    await invitado.getByLabel('Código de la sala').fill('ZZZZZZ');
    await invitado.getByRole('button', { name: 'Entrar' }).click();
    await expect(invitado.getByTestId('estado-casa')).toContainText('reintentando', { timeout: 60_000 });
  } finally {
    await context.close();
  }
});
