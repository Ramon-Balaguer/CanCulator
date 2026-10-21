// Service worker: red primero y caché si no hay conexión.
// El despliegue sustituye el marcador por el hash del commit, así cada versión
// tiene su propia caché y los móviles reciben la nueva.
const VERSION = '__COMMIT__';
const PREFIX = 'inventario-';
const CACHE = `${PREFIX}${VERSION}`;

const PRECACHE = [
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
  './js/datos/off.js',
  './js/datos/sincro.js',
  './js/datos/tienda.js',
  './js/logica/camara.js',
  './js/logica/codigo-barras.js',
  './js/logica/configuracion.js',
  './js/logica/copia.js',
  './js/logica/ean.js',
  './js/logica/estadisticas.js',
  './js/logica/fechas.js',
  './js/logica/imagen.js',
  './js/logica/inventario.js',
  './js/logica/nutricion.js',
  './js/logica/openfoodfacts.js',
  './js/logica/presentacion-off.js',
  './js/logica/sincronizacion.js',
  './js/logica/version.js',
  './js/prueba-camara.js',
  './js/prueba-sync.js',
  './js/ui/codigo-barras.js',
  './js/ui/componentes.js',
  './js/ui/datos-off.js',
  './js/ui/escaner.js',
  './js/ui/formularios.js',
  './js/ui/instalacion.js',
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Solo se cachean GET del propio origen. La sincronización (POST a Apps Script)
  // y Open Food Facts pasan directos.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const network = fromNetwork(request);
  event.waitUntil(network.catch(() => {}));
  event.respondWith(networkFirst(request, network));
});

// Con cobertura mala la red puede tardar mucho sin llegar a fallar. Pasado este
// tiempo se usa la copia en caché si la hay; si no la hay, se sigue esperando a la red.
const NETWORK_WAIT_MS = 4000;

async function fromNetwork(request) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, network) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('La red tarda demasiado')), NETWORK_WAIT_MS);
  });
  try {
    return await Promise.race([network, timeout]);
  } catch {
    const saved = await caches.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === 'navigate') {
      const start = await caches.match('./index.html');
      if (start) return start;
    }
    return network;
  } finally {
    clearTimeout(timer);
  }
}
