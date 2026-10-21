// Servidor HTTP de pruebas que ejecuta el Code.gs real sobre una hoja simulada.
// Hace de "Apps Script" en las pruebas E2E: el móvil le envía POST como lo haría en Google.
import { createServer } from 'node:http';
import { loadServer } from '../fixtures/cargar-code-gs.js';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function startFakeSheet({ token = 'secreto-e2e' } = {}) {
  const server = loadServer({ token });
  const http = createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, HEADERS).end();
      return;
    }
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const output = server.llamar(body);
      response.writeHead(200, { ...HEADERS, 'Content-Type': 'application/json' });
      response.end(JSON.stringify(output));
    });
  });
  await new Promise((resolve) => http.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${http.address().port}/exec`,
    token,
    hojas: server.sim.libro,
    ficheros: server.sim.ficheros,
    cerrar: () => new Promise((resolve) => http.close(resolve)),
  };
}
