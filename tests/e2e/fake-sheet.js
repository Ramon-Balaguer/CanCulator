// Test HTTP server that runs the real Code.gs over a simulated sheet.
// Acts as "Apps Script" in the E2E tests: the phone sends it POST as it would to Google.
import { createServer } from 'node:http';
import { loadServer } from '../fixtures/load-code-gs.js';

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
