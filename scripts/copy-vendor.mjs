// Copia a vendor/ las builds de navegador de las dependencias de ejecución, con sus licencias.
// No compila nada: son los ficheros tal cual los publica cada paquete.
// Uso: node scripts/copy-vendor.mjs
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = join(raiz, 'vendor');

// [origen en node_modules, destino en vendor/]
export const FICHEROS = [
  ['@zxing/browser/umd/zxing-browser.min.js', 'zxing-browser.min.js'],
  ['@zxing/browser/LICENSE', 'licencias/zxing-browser.txt'],
  ['preact/dist/preact.module.js', 'preact.module.js'],
  ['preact/hooks/dist/hooks.module.js', 'preact-hooks.module.js'],
  ['preact/LICENSE', 'licencias/preact.txt'],
  ['htm/dist/htm.module.js', 'htm.module.js'],
  ['htm/preact/index.module.js', 'htm-preact.module.js'],
  ['htm/LICENSE', 'licencias/htm.txt'],
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
