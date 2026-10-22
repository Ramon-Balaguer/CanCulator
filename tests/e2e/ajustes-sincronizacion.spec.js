import { test, expect } from '@playwright/test';

// Ajustes: dos zonas para sincronizar. «Crear main» guarda la password de sincronización y crea la sala
// (QR y código). «Crear cliente» abre el escáner, donde se pone la password y el código, o se hace la foto del QR.
test.describe('Ajustes: crear main y crear cliente', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  });

  test('hay una zona para crear el main y otra para crear clientes', async ({ page }) => {
    await expect(page.getByTestId('crear-main').getByRole('heading', { name: 'Crear main' })).toBeVisible();
    await expect(page.getByTestId('crear-cliente').getByRole('heading', { name: 'Crear cliente' })).toBeVisible();
  });

  test('el main pide la password de sincronización y explica para qué sirve', async ({ page }) => {
    const main = page.getByTestId('crear-main');
    await expect(main.getByLabel('Password de sincronización')).toBeVisible();
    await expect(main.getByLabel('Token')).toHaveCount(0);
    await expect(main.getByTestId('explicacion-password')).toBeVisible();
  });

  test('guardar la password en el main crea la sala: muestra el QR y el código', async ({ page }) => {
    const main = page.getByTestId('crear-main');
    await main.getByLabel('Password de sincronización').fill('clave-de-prueba');
    await main.getByRole('button', { name: 'Guardar y crear sala' }).click();
    await expect(main.locator('.qr svg')).toBeVisible();
    await expect(main.getByTestId('codigo-sala')).toHaveText(/^[A-Z2-9]{6}$/);
  });

  test('el cliente abre el escáner con password, código y foto del QR', async ({ page }) => {
    const cliente = page.getByTestId('crear-cliente');
    await cliente.getByRole('button', { name: 'Escanear QR' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear QR de la sala' });
    await expect(escaner.getByLabel('Password de sincronización')).toBeVisible();
    await expect(escaner.getByLabel('Código de la sala')).toBeVisible();
    await expect(escaner.getByLabel('Hacer foto del QR')).toBeAttached();
  });

  test('guardar en el escáner configura al cliente y lo deja dentro de la sala', async ({ page }) => {
    const cliente = page.getByTestId('crear-cliente');
    await cliente.getByRole('button', { name: 'Escanear QR' }).click();
    const escaner = page.getByRole('dialog', { name: 'Escanear QR de la sala' });
    await escaner.getByLabel('Password de sincronización').fill('clave-de-prueba');
    await escaner.getByLabel('Código de la sala').fill('ABC234');
    await escaner.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(escaner).toHaveCount(0);
    await expect(cliente.getByRole('button', { name: 'Salir de la sala' })).toBeVisible();
  });

  test('la zona de sincronizar indica cuántos móviles hay conectados', async ({ page }) => {
    const casa = page.getByTestId('sincronizacion-casa');
    await expect(casa.getByTestId('moviles-conectados')).toHaveText('Móviles conectados: 0');
  });
});
