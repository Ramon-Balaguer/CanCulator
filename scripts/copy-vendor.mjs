// Copies to vendor/ the browser builds of the runtime dependencies, with their licenses.
// It builds nothing: they are the files as each package publishes them.
// Usage: node scripts/copy-vendor.mjs
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = join(raiz, 'vendor');

// [origin in node_modules, destination in vendor/]
export const FICHEROS = [
  ['@zxing/browser/umd/zxing-browser.min.js', 'zxing-browser.min.js'],
  ['@zxing/browser/LICENSE', 'licenses/zxing-browser.txt'],
  ['preact/dist/preact.module.js', 'preact.module.js'],
  ['preact/hooks/dist/hooks.module.js', 'preact-hooks.module.js'],
  ['preact/LICENSE', 'licenses/preact.txt'],
  ['htm/dist/htm.module.js', 'htm.module.js'],
  ['htm/preact/index.module.js', 'htm-preact.module.js'],
  ['htm/LICENSE', 'licenses/htm.txt'],
];

export async function copiarVendor() {
  await rm(destino, { recursive: true, force: true });
  for (const [origen, nombre] of FICHEROS) {
    const ruta = join(destino, nombre);
    await mkdir(dirname(ruta), { recursive: true });
    await copyFile(join(raiz, 'node_modules', origen), ruta);
  }
  return destino;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`Copiado en ${await copiarVendor()}`);
}
