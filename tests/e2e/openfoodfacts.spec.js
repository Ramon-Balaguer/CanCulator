import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Recorded responses from the real API (tests/fixtures/off/). Served with CORS like the API.
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

function interceptOFF(page, response) {
  const calls = [];
  page.route('https://world.openfoodfacts.org/**', (route) => {
    calls.push(route.request().url());
    if (response === 'red') return route.abort('internetdisconnected');
    return route.fulfill({
      status: response.http,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(response.cuerpo),
    });
  });
  return calls;
}

async function scanCode(page, code) {
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
  const scanner = page.getByRole('dialog', { name: 'Escanear código' });
  await scanner.getByLabel('O escribe el código').fill(code);
  await scanner.getByRole('button', { name: 'Usar este código' }).click();
}

test.describe('Open Food Facts en el alta', () => {
  // Without a service worker: in WebKit, requests made by a page controlled by the
  // without connection can have a date earlier than the last sync of another phone.
  test.use({ serviceWorkers: 'block' });

  // The simulated Chromium camera emits a test code and would read it before the code typed
  // written by hand. Here a camera that does not exist is simulated: the manual entry is tested.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
  });

  test('código conocido: rellena el nombre con el dato de la API', async ({ page }) => {
    const calls = interceptOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await scanCode(page, MUESLI);
    const form = page.locator('.modal-pantalla');
    await expect(form.getByLabel('Producto')).toHaveValue('muesli raisin,datte,figue');
    await expect(form).toContainText('Open Food Facts: muesli raisin,datte,figue (Bjorg)');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`/api/v2/product/${MUESLI}.json`);
  });

  test('no encontrado: avisa y deja escribir el nombre; el alta se guarda igual', async ({ page }) => {
    interceptOFF(page, fixture('no-encontrado'));
    await page.goto('./');
    await scanCode(page, '2012345678903');
    const form = page.locator('.modal-pantalla');
    await expect(form).toContainText('No está en Open Food Facts. Escribe el nombre a mano.');
    await form.getByLabel('Producto').fill('Pan rallado casero');
    await form.getByLabel('Caducidad').fill('2027-03-01');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Pan rallado casero' })).toBeVisible();
  });

  test('sin conexión: el alta no se bloquea y el nombre queda a mano', async ({ page }) => {
    interceptOFF(page, 'red');
    await page.goto('./');
    await scanCode(page, '2012345678903');
    const form = page.locator('.modal-pantalla');
    await expect(form).toContainText('Sin conexión: escribe el nombre a mano.');
    await form.getByLabel('Producto').fill('Garbanzos de la tienda');
    await form.getByLabel('Caducidad').fill('2027-03-01');
    await form.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos de la tienda' })).toBeVisible();
  });

  test('la segunda vez que se escanea el mismo código sale de la caché, no de la red', async ({ page }) => {
    const calls = interceptOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await scanCode(page, MUESLI);
    await expect(page.locator('.modal-pantalla')).toContainText('Open Food Facts');
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Cancelar' }).click();
    await scanCode(page, MUESLI);
    await expect(page.locator('.modal-pantalla')).toContainText('Open Food Facts');
    expect(calls).toHaveLength(1);
  });

  test('un código con dígito de control incorrecto no consulta nada', async ({ page }) => {
    const calls = interceptOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    await page.getByRole('dialog', { name: 'Escanear código' }).getByLabel('O escribe el código').fill('3229820129489');
    await page.getByRole('dialog', { name: 'Escanear código' }).getByRole('button', { name: 'Usar este código' }).click();
    await expect(page.getByRole('dialog', { name: 'Escanear código' })).toContainText('dígito de control');
    expect(calls).toHaveLength(0);
  });

});
