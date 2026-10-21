import { test, expect } from '@playwright/test';

// Prototipo manual: usa el servicio público de señalización de PeerJS, así que requiere internet.
test('dos páginas se conectan por sala y se envían mensajes', async ({ browser }) => {
  test.skip(browser.browserType().name() !== 'chromium', 'WebRTC: el WebKit de Playwright no conecta las salas en este entorno; se prueba en iPhone real.');
  test.setTimeout(120_000);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const movilA = await a.newPage();
  const movilB = await b.newPage();
  try {
    await movilA.goto('./peer-test.html');
    await movilB.goto('./peer-test.html');
    await movilA.getByRole('button', { name: 'Crear sala' }).click();
    const codigo = await movilA.locator('#codigo').textContent();
    await movilB.locator('#codigo-sala').fill(codigo);
    await movilB.getByRole('button', { name: 'Unirse' }).click();
    await expect(movilA.locator('#estado')).toContainText('Conectado', { timeout: 60_000 });
    await expect(movilB.locator('#estado')).toContainText('Conectado', { timeout: 60_000 });
    await movilB.locator('#mensaje').fill('ping');
    await movilB.getByRole('button', { name: 'Enviar' }).click();
    await expect(movilA.locator('#mensajes')).toContainText('Recibido: ping', { timeout: 30_000 });
  } finally {
    await a.close();
    await b.close();
  }
});
