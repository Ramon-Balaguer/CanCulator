import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pngEan13 } from '../fixtures/barcode.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/off/${name}.json`, import.meta.url), 'utf8'));
const MUESLI = '3229820129488';

// La foto frontal de Open Food Facts se guarda en la base de datos del móvil al consultar el producto,
// para que la app la muestre aunque después no haya conexión.
test.describe('imagen de Open Food Facts guardada en local', () => {
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('sin cámara'), { name: 'NotFoundError' }));
    });
    await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fixture('encontrado-muesli').cuerpo),
    }));
    await page.route('https://images.openfoodfacts.org/**', (route) => route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: pngEan13('2012345678903', { ancho: 200, alto: 150 }),
    }));
  });

  // Lee de IndexedDB, directamente en la página, si la foto del producto está guardada.
  const fotoGuardada = (page) => page.evaluate((id) => new Promise((resolve, reject) => {
    const peticion = indexedDB.open('canculator');
    peticion.onerror = () => reject(peticion.error);
    peticion.onsuccess = () => {
      const bd = peticion.result;
      const busqueda = bd.transaction('Fotos', 'readonly').objectStore('Fotos').get(id);
      busqueda.onsuccess = () => {
        const bytes = busqueda.result?.bytes?.byteLength ?? 0;
        bd.close();
        resolve(bytes);
      };
      busqueda.onerror = () => reject(busqueda.error);
    };
  }), `off-${MUESLI}`);

  test('al escanear un producto, su foto queda guardada en la base de datos del móvil', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(MUESLI);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();

    await expect.poll(() => fotoGuardada(page)).toBeGreaterThan(0);
  });

  test('sin conexión, la imagen del producto sigue viéndose en la hoja de impresión', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Añadir lote' }).click();
    await page.locator('.modal-pantalla').getByRole('button', { name: 'Escanear código' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear código' });
    await escaner.getByLabel('O escribe el código').fill(MUESLI);
    await escaner.getByRole('button', { name: 'Usar este código' }).click();
    const alta = page.locator('.modal-pantalla');
    await alta.getByLabel('Caducidad').fill('2027-03-01');
    await alta.getByLabel('Unidades').fill('1');
    await alta.getByRole('button', { name: 'Guardar lote' }).click();
    await expect(page.locator('.modal-pantalla')).toHaveCount(0);
    await expect.poll(() => fotoGuardada(page)).toBeGreaterThan(0);

    // Sin red: ni Open Food Facts ni su servidor de imágenes responden.
    await page.unroute('https://world.openfoodfacts.org/**');
    await page.unroute('https://images.openfoodfacts.org/**');
    await page.route('https://world.openfoodfacts.org/**', (route) => route.abort('internetdisconnected'));
    await page.route('https://images.openfoodfacts.org/**', (route) => route.abort('internetdisconnected'));
    await page.reload();

    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Imprimir' }).click();
    const imagen = page.locator('table.tabla-imprimir tbody tr').first().locator('img.miniatura');
    await expect(imagen).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => imagen.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });
});
