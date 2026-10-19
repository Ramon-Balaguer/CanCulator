// Service worker: red primero y caché si no hay conexión.
// El despliegue sustituye el marcador por el hash del commit, así cada versión
// tiene su propia caché y los móviles reciben la nueva.
const VERSION = '__COMMIT__';
const PREFIJO = 'inventario-';
const CACHE = `${PREFIJO}${VERSION}`;

const PRECARGA = [
  './',
  './index.html',
  './css/app.css',
  './icons/apple-touch-icon.png',
  './icons/icono-192.png',
  './icons/icono-512.png',
  './js/app.js',
  './js/datos/copia-io.js',
  './js/datos/db.js',
  './js/datos/fotos.js',
  './js/datos/tienda.js',
  './js/logica/camara.js',
  './js/logica/codigo-barras.js',
  './js/logica/configuracion.js',
  './js/logica/copia.js',
  './js/logica/fechas.js',
  './js/logica/imagen.js',
  './js/logica/inventario.js',
  './js/logica/version.js',
  './js/prueba-camara.js',
  './js/ui/componentes.js',
  './js/ui/escaner.js',
  './js/ui/formularios.js',
  './js/ui/miniatura.js',
  './js/ui/pantallas.js',
  './js/ui/raiz.js',
  './js/version.js',
  './manifest.webmanifest',
  './prueba-camara.html',
  './vendor/htm-preact.module.js',
  './vendor/htm.module.js',
  './vendor/preact-hooks.module.js',
  './vendor/preact.module.js',
  './vendor/zxing-browser.min.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECARGA.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith(PREFIJO) && nombre !== CACHE)
          .map((nombre) => caches.delete(nombre)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  // Solo se cachean GET del propio origen. La sincronización (POST a Apps Script)
  // y Open Food Facts pasan directos.
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) return;
  const red = desdeRed(peticion);
  evento.waitUntil(red.catch(() => {}));
  evento.respondWith(redPrimero(peticion, red));
});

// Con cobertura mala la red puede tardar mucho sin llegar a fallar. Pasado este
// tiempo se usa la copia en caché si la hay; si no la hay, se sigue esperando a la red.
const ESPERA_RED_MS = 4000;

async function desdeRed(peticion) {
  const respuesta = await fetch(peticion);
  if (respuesta.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(peticion, respuesta.clone());
  }
  return respuesta;
}

async function redPrimero(peticion, red) {
  let temporizador;
  const tiempoAgotado = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error('La red tarda demasiado')), ESPERA_RED_MS);
  });
  try {
    return await Promise.race([red, tiempoAgotado]);
  } catch {
    const guardada = await caches.match(peticion, { ignoreSearch: true });
    if (guardada) return guardada;
    if (peticion.mode === 'navigate') {
      const inicio = await caches.match('./index.html');
      if (inicio) return inicio;
    }
    return red;
  } finally {
    clearTimeout(temporizador);
  }
}
