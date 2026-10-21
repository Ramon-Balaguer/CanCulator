// Static server for development and tests, without dependencies.
// Serves the app under a base path, like GitHub Pages (user.github.io/repository/),
// so it does not travel in JSON copies or in the sync.
// Usage: node scripts/serve.mjs [folder]   Variables: PUERTO (4173), BASE (/inventario/)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.env.PUERTO ?? 4173);
const base = process.env.BASE ?? '/inventario/';

const GTIN_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm',
};

createServer(async (request, response) => {
  const route = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  if (route === '/' || route === base.slice(0, -1)) {
    response.writeHead(302, { Location: base }).end();
    return;
  }
  if (!route.startsWith(base)) {
    response.writeHead(404).end('No encontrado');
    return;
  }
  let uploadedFile = normalize(join(root, route.slice(base.length)));
  if (uploadedFile !== root && !uploadedFile.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(uploadedFile)).isDirectory()) uploadedFile = join(uploadedFile, 'index.html');
    const data = await readFile(uploadedFile);
    response.writeHead(200, {
      'Content-Type': GTIN_TYPES[extname(uploadedFile)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(data);
  } catch {
    response.writeHead(404).end('No encontrado');
  }
}).listen(port, function () {
  // With PUERTO=0 the system picks a free port; the real one is announced.
  console.log(`Sirviendo ${root} en http://localhost:${this.address().port}${base}`);
});
