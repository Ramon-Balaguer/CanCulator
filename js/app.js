import { html, render } from 'htm/preact';
import { VERSION } from './version.js';
import { textoVersion } from './logica/version.js';
import { abrirBD } from './datos/db.js';
import { Raiz } from './ui/raiz.js';

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

const contenedor = document.getElementById('contenido');
abrirBD()
  .then((db) => render(html`<${Raiz} db=${db} />`, contenedor))
  .catch((error) => {
    // Sin IndexedDB no hay forma de guardar nada: se avisa claro en lugar de una pantalla vacía.
    contenedor.textContent = `No se puede guardar datos en este navegador: ${error.message}`;
    contenedor.dataset.error = 'bd';
  });
