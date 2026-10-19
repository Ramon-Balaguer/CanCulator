import { VERSION } from './version.js';
import { textoVersion } from './logica/version.js';

document.getElementById('version').textContent = textoVersion(VERSION);

const estadoConexion = document.getElementById('estado-conexion');
function pintarConexion() {
  const enLinea = navigator.onLine;
  estadoConexion.dataset.estado = enLinea ? 'en-linea' : 'sin-conexion';
  estadoConexion.textContent = enLinea ? 'En línea' : 'Sin conexión';
}
window.addEventListener('online', pintarConexion);
window.addEventListener('offline', pintarConexion);
pintarConexion();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { scope: './' }).catch((error) => {
    console.error('No se pudo registrar el service worker', error);
  });
}
