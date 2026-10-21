import { test, expect } from '@playwright/test';

// Con los móviles conectados, cada cambio llega al otro sin pulsar nada.
test('un cambio con la sala abierta llega al otro móvil al momento', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: solo Chromium en este entorno.');
  test.setTimeout(180_000);
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
    await expect(anfitrion.getByTestId('estado-casa')).toContainText('Conectado', { timeout: 90_000 });

    // Un lote nuevo en el anfitrión: aparece en el invitado sin más acciones.
    await anfitrion.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await anfitrion.getByRole('button', { name: 'Añadir lote' }).click();
    const alta = anfitrion.locator('.modal-pantalla');
    await alta.getByLabel('Producto').fill('Arroz en vivo');
    await alta.getByLabel('Caducidad').fill('2027-08-01');
    await alta.getByLabel('Unidades').fill('3');
    await alta.getByRole('button', { name: 'Guardar lote' }).click();

    await invitado.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' }).click();
    await expect(invitado.locator('li.tarjeta', { hasText: 'Arroz en vivo' })).toContainText('3 ud.', { timeout: 30_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
