// Prueba aislada del envío POST a Apps Script. Igual que la sincronización real:
// text/plain (sin preflight CORS), cuerpo JSON, redirecciones seguidas.
// No guarda datos. Muestra el resultado tal cual para diagnosticar problemas de despliegue.

const formulario = document.getElementById('formulario');
const salida = document.getElementById('resultado');
const campoUrl = document.getElementById('url');
const campoToken = document.getElementById('token');

const URL_GUARDADA = 'prueba-sync-url';

try {
  campoUrl.value = localStorage.getItem(URL_GUARDADA) ?? '';
} catch {
  // Sin almacenamiento disponible, se escribe la URL a mano.
}

function escribir(lineas) {
  salida.textContent = lineas.join('\n');
}

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const url = campoUrl.value.trim();
  const token = campoToken.value.trim();
  try {
    localStorage.setItem(URL_GUARDADA, url);
  } catch {
    // Sin almacenamiento, no se recuerda la URL.
  }
  escribir(['Enviando…']);
  const inicio = performance.now();
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'ping', token }),
      redirect: 'follow',
    });
    const texto = await respuesta.text();
    const tiempo = Math.round(performance.now() - inicio);
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      // No es JSON: se muestra el inicio de la respuesta para ver qué devolvió el servidor.
    }
    escribir([
      `HTTP ${respuesta.status} (${tiempo} ms)`,
      `URL final tras redirecciones: ${respuesta.url}`,
      json
        ? (json.ok ? `OK · servidor versión ${json.version}` : `Error del servidor: ${json.error}`)
        : `La respuesta no es JSON. Inicio: ${texto.slice(0, 200)}`,
    ]);
  } catch (error) {
    escribir([
      'No llegó ninguna respuesta.',
      `Detalle: ${error.message}`,
      'Causas típicas: URL mal copiada, implementación sin acceso «Cualquier usuario», o sin conexión.',
    ]);
  }
});
