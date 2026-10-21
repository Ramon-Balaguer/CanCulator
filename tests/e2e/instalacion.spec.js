import { test, expect } from '@playwright/test';

test('en iPhone, Ajustes explica cómo añadir a la pantalla de inicio', async ({ browser }) => {
  const contexto = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  });
  const pagina = await contexto.newPage();
  await pagina.goto('./');
  await pagina.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  await expect(pagina.getByTestId('instalar-ios')).toContainText('Añadir a pantalla de inicio');
  await contexto.close();
});

test('en Android sin aviso del navegador, Ajustes indica el menú del navegador', async ({ page, browserName }) => {
  // webkit-movil simula un iPhone: esa pantalla se comprueba en la prueba de iOS.
  test.skip(browserName !== 'chromium', 'Prueba de Android: solo Chromium.');
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByTestId('instalar-android')).toContainText('menú del navegador');
});
