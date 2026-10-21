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
  './js/datos/backup-io.js',
  './js/datos/db.js',
  './js/datos/photos.js',
  './js/datos/off.js',
  './js/datos/sync.js',
  './js/datos/store.js',
  './js/logica/camera.js',
  './js/logica/barcode.js',
  './js/logica/settings.js',
  './js/logica/backup.js',
  './js/logica/ean.js',
  './js/logica/statistics.js',
  './js/logica/dates.js',
  './js/logica/image.js',
  './js/logica/inventory.js',
  './js/logica/nutrition.js',
  './js/logica/openfoodfacts.js',
  './js/logica/off-presentation.js',
  './js/logica/sync-logic.js',
  './js/logica/version.js',
  './js/camera-test.js',
  './js/sync-test.js',
  './js/ui/barcode-view.js',
  './js/ui/components.js',
  './js/ui/off-data.js',
  './js/ui/scanner.js',
  './js/ui/forms.js',
  './js/ui/install.js',
  './js/ui/thumbnail.js',
  './js/ui/screens.js',
  './js/ui/root.js',
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
