import { test, expect } from '@playwright/test';
import { ownServer } from './own-server.js';

test('la página muestra el nombre de la app', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Inventario de casa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario de casa');
  await expect(page.locator('#version')).toHaveText('desarrollo');
});

test('el manifest es válido y enlaza iconos que existen', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestUrl = new URL(href, page.url()).href;
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe('Inventario de casa');
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('es');
  for (const icon of manifest.icons) {
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect(r.ok(), icon.src).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('sin conexión: tras cortar la red y recargar, la app carga desde la caché', async ({ page }) => {
  // WebKit on Windows takes ~20 s to fail requests to a closed port.
  test.setTimeout(60_000);
  const server = await ownServer();
  try {
    await page.goto(server.url);
    // Waits for the service worker to control the page.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });

    await server.cortar();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario de casa');
    await expect(page.locator('#version')).toHaveText('desarrollo');

    // The camera page (Preact, htm and ZXing in vendor/) also works offline.
    // Wide margin: on Windows, WebKit takes ~2 s to fail each request to a closed port
    // closed, and the modules are requested in a chain. On Linux the failure is immediate.
    await page.goto(new URL('camera-test.html', server.url).href);
    await expect(page.getByRole('button', { name: 'Abrir cámara' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await server.cortar();
  }
});
