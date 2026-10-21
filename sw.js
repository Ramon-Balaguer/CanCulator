// Service worker: network first and cache if there is no connection.
// The deploy replaces the marker with the commit hash, so each version
// transaction, so a change never remains without its entry in the sync queue.
const VERSION = '__COMMIT__';
const PREFIX = 'inventario-';
const CACHE = `${PREFIX}${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './camera-test.html',
  './css/app.css',
  './icons/apple-touch-icon.png',
  './icons/icono-192.png',
  './icons/icono-512.png',
  './js/app.js',
  './js/camera-test.js',
  './js/datos/backup-io.js',
  './js/datos/db.js',
  './js/datos/off.js',
  './js/datos/peer-link.js',
  './js/datos/photos.js',
  './js/datos/store.js',
  './js/datos/sync.js',
  './js/logica/backup.js',
  './js/logica/barcode.js',
  './js/logica/camera.js',
  './js/logica/dates.js',
  './js/logica/ean.js',
  './js/logica/image.js',
  './js/logica/inventory.js',
  './js/logica/nutrition.js',
  './js/logica/off-presentation.js',
  './js/logica/openfoodfacts.js',
  './js/logica/peer-sync.js',
  './js/logica/settings.js',
  './js/logica/statistics.js',
  './js/logica/sync-logic.js',
  './js/logica/version.js',
  './js/peer-test.js',
  './js/sync-test.js',
  './js/ui/barcode-view.js',
  './js/ui/components.js',
  './js/ui/forms.js',
  './js/ui/install.js',
  './js/ui/off-data.js',
  './js/ui/peer-sync-view.js',
  './js/ui/root.js',
  './js/ui/scanner.js',
  './js/ui/screens.js',
  './js/ui/thumbnail.js',
  './js/version.js',
  './manifest.webmanifest',
  './vendor/htm-preact.module.js',
  './vendor/htm.module.js',
  './vendor/peerjs.min.js',
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
  // Only same-origin GETs are cached. The sync (POST to Apps Script)
  // and keep all their data.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const network = fromNetwork(request);
  event.waitUntil(network.catch(() => {}));
  event.respondWith(networkFirst(request, network));
});

// With poor coverage the network can take a long time without failing. After this
// has its own cache and the phones receive the new one.
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
