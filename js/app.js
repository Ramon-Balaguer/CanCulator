import { html, render } from 'htm/preact';
import { VERSION } from './version.js';
import { versionText } from './logica/version.js';
import { openDatabase } from './datos/db.js';
import { alCambiarConectadas } from './datos/peer-link.js';
import { Root } from './ui/root.js';
import { startInstallCapture } from './ui/install.js';

startInstallCapture();

document.getElementById('version').textContent = versionText(VERSION);

const connectionStatus = document.getElementById('estado-conexion');
function paintConnection() {
  const online = navigator.onLine;
  connectionStatus.dataset.estado = online ? 'en-linea' : 'sin-conexion';
  connectionStatus.textContent = online ? 'En línea' : 'Sin conexión';
}
window.addEventListener('online', paintConnection);
window.addEventListener('offline', paintConnection);
paintConnection();

// Aviso en la cabecera cuando hay otro móvil sincronizando con este.
const syncStatus = document.getElementById('estado-sync');
alCambiarConectadas((n) => {
  syncStatus.hidden = n === 0;
  syncStatus.dataset.estado = n > 0 ? 'conectado' : 'solo';
  syncStatus.textContent = n === 1 ? '⇄ Conectado' : `⇄ ${n} conectados`;
});

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
    container.textContent = `No se puede guardar datos en este navegador: ${error.message}`;
    container.dataset.error = 'bd';
  });
