import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CODIGO_PRUEBA, y4mEan13 } from './tests/fixtures/codigo-barras.js';

const PUERTO = 4173;
const BASE = '/inventario/';

// Vídeo con un código de barras que Chromium usa como cámara simulada.
// Se genera solo en el proceso principal; los workers lo reutilizan.
const VIDEO_CAMARA = fileURLToPath(new URL('./tests/.generados/camara.y4m', import.meta.url));
if (process.env.TEST_WORKER_INDEX === undefined) {
  mkdirSync(new URL('./tests/.generados/', import.meta.url), { recursive: true });
  writeFileSync(VIDEO_CAMARA, y4mEan13(CODIGO_PRUEBA));
}

const camaraSimulada = {
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO_CAMARA}`,
    ],
  },
};

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
    { name: 'chromium-escritorio', use: { ...devices['Desktop Chrome'], ...camaraSimulada } },
    { name: 'webkit-escritorio', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-movil', use: { ...devices['Pixel 7'], ...camaraSimulada } },
    { name: 'webkit-movil', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'node scripts/servir.mjs',
    url: `http://localhost:${PUERTO}${BASE}`,
    env: { PUERTO: String(PUERTO), BASE },
    reuseExistingServer: !process.env.CI,
  },
});
