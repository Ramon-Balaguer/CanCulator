// Servidor estático para desarrollo y pruebas, sin dependencias.
// Monta la app bajo una ruta base, igual que GitHub Pages (usuario.github.io/repositorio/),
// para detectar rutas absolutas que fallarían al publicar.
// Uso: node scripts/serve.mjs [carpeta]   Variables: PUERTO (4173), BASE (/inventario/)
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
  // Con PUERTO=0 el sistema elige uno libre; se anuncia el real.
  console.log(`Sirviendo ${root} en http://localhost:${this.address().port}${base}`);
});
