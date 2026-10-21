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
  // WebKit en Windows tarda ~20 s en dar por fallidas las peticiones a un puerto cerrado.
  test.setTimeout(60_000);
  const server = await ownServer();
  try {
    await page.goto(server.url);
    // Espera a que el service worker controle la página.
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

    // La página de cámara (Preact, htm y ZXing en vendor/) también funciona sin red.
    // Margen amplio: en Windows, WebKit tarda ~2 s en dar por fallida cada petición a un puerto
    // cerrado, y los módulos se piden en cadena. En Linux el fallo es inmediato.
    await page.goto(new URL('prueba-camara.html', server.url).href);
    await expect(page.getByRole('button', { name: 'Abrir cámara' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await server.cortar();
  }
});
