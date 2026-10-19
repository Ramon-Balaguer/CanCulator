import { defineConfig, devices } from '@playwright/test';

const PUERTO = 4173;
const BASE = '/inventario/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}${BASE}`,
    serviceWorkers: 'allow',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-escritorio', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-escritorio', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-movil', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-movil', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'node scripts/servir.mjs',
    url: `http://localhost:${PUERTO}${BASE}`,
    env: { PUERTO: String(PUERTO), BASE },
    reuseExistingServer: !process.env.CI,
  },
});
