import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Respuestas grabadas de la API real (tests/fixtures/off/). Se sirven con CORS como la API.
const fixture = (nombre) => JSON.parse(readFileSync(new URL(`../fixtures/off/${nombre}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

function interceptarOFF(page, respuesta) {
  const llamadas = [];
  page.route('https://world.openfoodfacts.org/**', (ruta) => {
    llamadas.push(ruta.request().url());
    if (respuesta === 'red') return ruta.abort('internetdisconnected');
    return ruta.fulfill({
      status: respuesta.http,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(respuesta.cuerpo),
    });
  });
  return llamadas;
}

async function escanearCodigo(page, codigo) {
  await page.getByRole('button', { name: 'Añadir lote' }).click();
  await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
  const escaner = page.getByRole('dialog', { name: 'Escanear código' });
  await escaner.getByLabel('O escribe el código').fill(codigo);
  await escaner.getByRole('button', { name: 'Usar este código' }).click();
}

test.describe('Open Food Facts en el alta', () => {
  // Sin service worker: en WebKit, las peticiones que hace una página controlada por el
  // service worker no pasan por la intercepción de Playwright y saldrían a la red real.
  test.use({ serviceWorkers: 'block' });

  // La cámara simulada de Chromium emite un código de prueba y lo leería antes que el código
  // escrito a mano. Aquí se simula una cámara que no existe: se prueba la entrada manual.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
  });

  test('código conocido: rellena el nombre con el dato de la API', async ({ page }) => {
    const llamadas = interceptarOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await escanearCodigo(page, MUESLI);
    const formulario = page.locator('.modal-pantalla');
    await expect(formulario.getByLabel('Producto')).toHaveValue('muesli raisin,datte,figue');
    await expect(formulario).toContainText('Open Food Facts: muesli raisin,datte,figue (Bjorg)');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]).toContain(`/api/v2/product/${MUESLI}.json`);
  });

  test('no encontrado: avisa y deja escribir el nombre; el alta se guarda igual', async ({ page }) => {
    interceptarOFF(page, fixture('no-encontrado'));
    await page.goto('./');
    await escanearCodigo(page, '2012345678903');
    const formulario = page.locator('.modal-pantalla');
    await expect(formulario).toContainText('No está en Open Food Facts. Escribe el nombre a mano.');
    await formulario.getByLabel('Producto').fill('Pan rallado casero');
    await formulario.getByLabel('Caducidad').fill('2027-03-01');
    await formulario.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Pan rallado casero' })).toBeVisible();
  });

  test('sin conexión: el alta no se bloquea y el nombre queda a mano', async ({ page }) => {
    interceptarOFF(page, 'red');
    await page.goto('./');
    await escanearCodigo(page, '2012345678903');
    const formulario = page.locator('.modal-pantalla');
    await expect(formulario).toContainText('Sin conexión: escribe el nombre a mano.');
    await formulario.getByLabel('Producto').fill('Garbanzos de la tienda');
    await formulario.getByLabel('Caducidad').fill('2027-03-01');
    await formulario.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('li.tarjeta', { hasText: 'Garbanzos de la tienda' })).toBeVisible();
  });

  test('la segunda vez que se escanea el mismo código sale de la caché, no de la red', async ({ page }) => {
    const llamadas = interceptarOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await escanearCodigo(page, MUESLI);
    await expect(page.locator('.modal-pantalla')).toContainText('Open Food Facts');
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Cancelar' }).click();
    await escanearCodigo(page, MUESLI);
    await expect(page.locator('.modal-pantalla')).toContainText('Open Food Facts');
    expect(llamadas).toHaveLength(1);
  });

  test('un código con dígito de control incorrecto no consulta nada', async ({ page }) => {
    const llamadas = interceptarOFF(page, fixture('encontrado-muesli'));
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    await page.getByRole('dialog', { name: 'Escanear código' }).getByLabel('O escribe el código').fill('3229820129489');
    await page.getByRole('dialog', { name: 'Escanear código' }).getByRole('button', { name: 'Usar este código' }).click();
    await expect(page.getByRole('dialog', { name: 'Escanear código' })).toContainText('dígito de control');
    expect(llamadas).toHaveLength(0);
  });

});
