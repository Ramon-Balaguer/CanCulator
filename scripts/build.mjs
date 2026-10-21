// Prepares the _site folder for GitHub Pages: copies the app files
// (without tests or node_modules) and injects the commit hash.
// It builds nothing: what is published is the same code that runs locally.
// Usage: node scripts/build.mjs <commit-hash>
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { injectVersion } from '../js/logica/version.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = join(root, '_site');

export const PUBLISHED = ['index.html', 'camera-test.html', 'sync-test.html', 'prueba-camara.html', 'prueba-sync.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'vendor'];
export const WITH_VERSION = ['sw.js', 'js/version.js'];

export async function build(hash) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const entry of PUBLISHED) {
    const origin = join(root, entry);
    if (existsSync(origin)) await cp(origin, join(destination, entry), { recursive: true });
  }
  for (const uploadedFile of WITH_VERSION) {
    const route = join(destination, uploadedFile);
    await writeFile(route, injectVersion(await readFile(route, 'utf8'), hash));
  }
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const hash = process.argv[2] ?? process.env.GITHUB_SHA;
  if (!hash) {
    console.error('Falta el hash del commit');
    process.exit(1);
  }
  console.log(`Construido en ${await build(hash)} con versión ${hash}`);
}
