import { test, expect } from '@playwright/test';
import { servidorPropio } from './servidor-propio.js';

test('la página muestra el nombre de la app', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Inventario de casa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario de casa');
  await expect(page.locator('#version')).toHaveText('desarrollo');
});

test('el manifest es válido y enlaza iconos que existen', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const urlManifest = new URL(href, page.url()).href;
  const respuesta = await request.get(urlManifest);
  expect(respuesta.ok()).toBeTruthy();
  const manifest = await respuesta.json();
  expect(manifest.name).toBe('Inventario de casa');
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('es');
  for (const icono of manifest.icons) {
    const r = await request.get(new URL(icono.src, urlManifest).href);
    expect(r.ok(), icono.src).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('sin conexión: tras cortar la red y recargar, la app carga desde la caché', async ({ page }) => {
  const servidor = await servidorPropio();
  try {
    await page.goto(servidor.url);
    // Espera a que el service worker controle la página.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolver) => navigator.serviceWorker.addEventListener('controllerchange', resolver, { once: true }));
      }
    });

    await servidor.cortar();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inventario de casa');
    await expect(page.locator('#version')).toHaveText('desarrollo');

    // La página de cámara (Preact, htm y ZXing en vendor/) también funciona sin red.
    // Margen amplio: en Windows, WebKit tarda ~2 s en dar por fallida cada petición a un puerto
    // cerrado, y los módulos se piden en cadena. En Linux el fallo es inmediato.
    await page.getByRole('link', { name: 'Prueba de cámara y código de barras' }).click();
    await expect(page.getByRole('button', { name: 'Abrir cámara' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await servidor.cortar();
  }
});
