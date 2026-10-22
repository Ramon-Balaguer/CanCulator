import { test, expect } from '@playwright/test';
import { abrirAjustes, crearMain, entrarComoCliente } from './sincronizacion.js';

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
    await abrirAjustes(anfitrion);
    const codigo = await crearMain(anfitrion);
    await abrirAjustes(invitado);
    await entrarComoCliente(invitado, codigo);
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
