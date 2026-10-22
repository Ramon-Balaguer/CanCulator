import { html, render } from 'htm/preact';
import { VERSION } from './version.js';
import { versionText } from './logica/version.js';
import { t, idiomaActual, alCambiarIdioma } from './logica/idioma.js';
import { openDatabase } from './datos/db.js';
import { alCambiarConectadas } from './datos/peer-link.js';
import { Root } from './ui/root.js';
import { startInstallCapture } from './ui/install.js';

startInstallCapture();

document.getElementById('version').textContent = versionText(VERSION);

// Textos que están fuera de Preact (cabecera, estado de conexión y de sincronización).
// Se vuelven a escribir al cambiar de idioma.
const connectionStatus = document.getElementById('estado-conexion');
const syncStatus = document.getElementById('estado-sync');
let ultimosMoviles = 0;

function paintConnection() {
  const online = navigator.onLine;
  connectionStatus.dataset.estado = online ? 'en-linea' : 'sin-conexion';
  connectionStatus.textContent = online ? t('conexion.en_linea') : t('conexion.sin_conexion');
}

function paintSync() {
  syncStatus.hidden = ultimosMoviles === 0;
  syncStatus.dataset.estado = ultimosMoviles > 0 ? 'conectado' : 'solo';
  syncStatus.textContent = ultimosMoviles === 1 ? t('sync.conectado') : t('sync.n_conectados', { n: ultimosMoviles });
}

function paintStaticText() {
  document.documentElement.lang = idiomaActual();
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  paintConnection();
  paintSync();
}

window.addEventListener('online', paintConnection);
window.addEventListener('offline', paintConnection);

// Aviso en la cabecera cuando hay otro móvil sincronizando con este.
alCambiarConectadas((n) => {
  ultimosMoviles = n;
  paintSync();
});

alCambiarIdioma(paintStaticText);
paintStaticText();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch((error) => {
    console.error('No se pudo registrar el service worker', error);
  });
}

const container = document.getElementById('contenido');
openDatabase()
  .then((db) => render(html`<${Root} db=${db} />`, container))
  .catch((error) => {
    // Without IndexedDB there is no way to save anything: it warns clearly instead of an empty screen.
    container.textContent = t('app.no_se_puede_guardar', { error: error.message });
    container.dataset.error = 'bd';
  });
