// Servidor estático para desarrollo y pruebas, sin dependencias.
// Monta la app bajo una ruta base, igual que GitHub Pages (usuario.github.io/repositorio/),
// para detectar rutas absolutas que fallarían al publicar.
// Uso: node scripts/servir.mjs [carpeta]   Variables: PUERTO (4173), BASE (/inventario/)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const raiz = resolve(process.argv[2] ?? '.');
const puerto = Number(process.env.PUERTO ?? 4173);
const base = process.env.BASE ?? '/inventario/';

const TIPOS = {
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

createServer(async (peticion, respuesta) => {
  const ruta = decodeURIComponent(new URL(peticion.url, 'http://local').pathname);
  if (ruta === '/' || ruta === base.slice(0, -1)) {
    respuesta.writeHead(302, { Location: base }).end();
    return;
  }
  if (!ruta.startsWith(base)) {
    respuesta.writeHead(404).end('No encontrado');
    return;
  }
  let fichero = normalize(join(raiz, ruta.slice(base.length)));
  if (fichero !== raiz && !fichero.startsWith(raiz + sep)) {
    respuesta.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(fichero)).isDirectory()) fichero = join(fichero, 'index.html');
    const datos = await readFile(fichero);
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[extname(fichero)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    respuesta.end(datos);
  } catch {
    respuesta.writeHead(404).end('No encontrado');
  }
}).listen(puerto, function () {
  // Con PUERTO=0 el sistema elige uno libre; se anuncia el real.
  console.log(`Sirviendo ${raiz} en http://localhost:${this.address().port}${base}`);
});
