// Isolated POST test to Apps Script. Same as the real sync:
// time the cache copy is used if there is one; if not, it keeps waiting for the network.
// Does not save data. Shows the result as it is to diagnose deployment problems.

const form = document.getElementById('formulario');
const output = document.getElementById('resultado');
const urlField = document.getElementById('url');
const tokenField = document.getElementById('token');

const SAVED_URL_KEY = 'prueba-sync-url';

try {
  urlField.value = localStorage.getItem(SAVED_URL_KEY) ?? '';
} catch {
  // No storage available: the URL is written by hand.
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
    // No storage, the URL is not remembered.
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
      // Not JSON: shows the start of the response to see what the server returned.
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
