// Prueba aislada del envío POST a Apps Script. Igual que la sincronización real:
// text/plain (sin preflight CORS), cuerpo JSON, redirecciones seguidas.
// No guarda datos. Muestra el resultado tal cual para diagnosticar problemas de despliegue.

const form = document.getElementById('formulario');
const output = document.getElementById('resultado');
const urlField = document.getElementById('url');
const tokenField = document.getElementById('token');

const SAVED_URL_KEY = 'prueba-sync-url';

try {
  urlField.value = localStorage.getItem(SAVED_URL_KEY) ?? '';
} catch {
  // Sin almacenamiento disponible, se escribe la URL a mano.
}

function write(lines) {
  output.textContent = lines.join('\n');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = urlField.value.trim();
  const token = tokenField.value.trim();
  try {
    localStorage.setItem(SAVED_URL_KEY, url);
  } catch {
    // Sin almacenamiento, no se recuerda la URL.
  }
  write(['Enviando…']);
  const start = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'ping', token }),
      redirect: 'follow',
    });
    const text = await response.text();
    const elapsed = Math.round(performance.now() - start);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // No es JSON: se muestra el inicio de la respuesta para ver qué devolvió el servidor.
    }
    write([
      `HTTP ${response.status} (${elapsed} ms)`,
      `URL final tras redirecciones: ${response.url}`,
      json
        ? (json.ok ? `OK · servidor versión ${json.version}` : `Error del servidor: ${json.error}`)
        : `La respuesta no es JSON. Inicio: ${text.slice(0, 200)}`,
    ]);
  } catch (error) {
    write([
      'No llegó ninguna respuesta.',
      `Detalle: ${error.message}`,
      'Causas típicas: URL mal copiada, implementación sin acceso «Cualquier usuario», o sin conexión.',
    ]);
  }
});
