// Prepara la carpeta _site para GitHub Pages: copia los ficheros de la app
// (sin pruebas ni node_modules) e inyecta el hash del commit.
// No compila nada: lo publicado es el mismo código que se ejecuta en local.
// Uso: node scripts/construir.mjs <hash-del-commit>
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { inyectarVersion } from '../js/logica/version.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = join(raiz, '_site');

export const PUBLICADOS = ['index.html', 'prueba-camara.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'vendor'];
export const CON_VERSION = ['sw.js', 'js/version.js'];

export async function construir(hash) {
  await rm(destino, { recursive: true, force: true });
  await mkdir(destino, { recursive: true });
  for (const entrada of PUBLICADOS) {
    const origen = join(raiz, entrada);
    if (existsSync(origen)) await cp(origen, join(destino, entrada), { recursive: true });
  }
  for (const fichero of CON_VERSION) {
    const ruta = join(destino, fichero);
    await writeFile(ruta, inyectarVersion(await readFile(ruta, 'utf8'), hash));
  }
  return destino;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hash = process.argv[2] ?? process.env.GITHUB_SHA;
  if (!hash) {
    console.error('Falta el hash del commit');
    process.exit(1);
  }
  console.log(`Construido en ${await construir(hash)} con versión ${hash}`);
}
