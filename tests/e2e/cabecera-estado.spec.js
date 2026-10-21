import { test, expect } from '@playwright/test';
test('la versión y la conexión están en la cabecera, no al pie', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('header.cabecera #version')).not.toHaveText('');
  await expect(page.locator('header.cabecera #estado-conexion')).toHaveText('En línea');
  await expect(page.locator('footer.pie')).toHaveCount(0);
});
