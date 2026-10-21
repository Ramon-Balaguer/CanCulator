import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEST_CODE, y4mEan13 } from './tests/fixtures/barcode.js';

const PORT = 4173;
const BASE = '/inventario/';

// Vídeo con un código de barras que Chromium usa como cámara simulada.
// Se genera solo en el proceso principal; los workers lo reutilizan.
const CAMERA_VIDEO = fileURLToPath(new URL('./tests/.generados/camara.y4m', import.meta.url));
if (process.env.TEST_WORKER_INDEX === undefined) {
  mkdirSync(new URL('./tests/.generados/', import.meta.url), { recursive: true });
  writeFileSync(CAMERA_VIDEO, y4mEan13(TEST_CODE));
}

const simulatedCamera = {
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${CAMERA_VIDEO}`,
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
    baseURL: `http://localhost:${PORT}${BASE}`,
    serviceWorkers: 'allow',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium-escritorio', use: { ...devices['Desktop Chrome'], ...simulatedCamera } },
    { name: 'webkit-escritorio', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-movil', use: { ...devices['Pixel 7'], ...simulatedCamera } },
    { name: 'webkit-movil', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://localhost:${PORT}${BASE}`,
    env: { PUERTO: String(PORT), BASE },
    reuseExistingServer: !process.env.CI,
  },
});
