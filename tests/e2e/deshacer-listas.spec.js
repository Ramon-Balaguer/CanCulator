import { test, expect } from '@playwright/test';

test('quitar una categoría se puede deshacer desde el aviso', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Quitar otros' }).click();
  await expect(page.locator('li.chip', { hasText: 'otros' })).toHaveCount(0);
  await page.getByRole('status').filter({ hasText: 'Deshacer' }).click();
  await expect(page.locator('li.chip', { hasText: 'otros' })).toBeVisible();
});
