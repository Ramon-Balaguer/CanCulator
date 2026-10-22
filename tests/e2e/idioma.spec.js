import { test, expect } from '@playwright/test';

// Idioma: el primer ajuste de la pantalla Ajustes elige español o inglés, y la elección sobrevive a recargar.
test.describe('Idioma de la app', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  });

  test('el primer ajuste es el idioma', async ({ page }) => {
    const primero = page.locator('.pantalla .bloque').first();
    await expect(primero.getByRole('heading', { name: 'Idioma' })).toBeVisible();
    await expect(primero.getByLabel('Idioma')).toHaveValue('es');
  });

  test('cambiar a inglés traduce la pantalla y la elección se mantiene tras recargar', async ({ page }) => {
    await page.getByLabel('Idioma').selectOption('en');
    const barra = page.getByRole('navigation', { name: 'Screens' });
    await expect(barra.getByRole('button', { name: 'Settings' })).toBeVisible();
    await expect(barra.getByRole('button', { name: 'Expiry' })).toBeVisible();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Expiry' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Language')).toHaveValue('en');
  });

  test('volver a español traduce de nuevo la pantalla', async ({ page }) => {
    await page.getByLabel('Idioma').selectOption('en');
    await page.getByLabel('Language').selectOption('es');
    await expect(page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Caducidad' })).toBeVisible();
  });
});
