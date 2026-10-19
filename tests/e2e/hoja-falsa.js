// Servidor HTTP de pruebas que ejecuta el Code.gs real sobre una hoja simulada.
// Hace de "Apps Script" en las pruebas E2E: el móvil le envía POST como lo haría en Google.
import { createServer } from 'node:http';
import { cargarServidor } from '../fixtures/cargar-code-gs.js';

const CABECERAS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function iniciarHojaFalsa({ token = 'secreto-e2e' } = {}) {
  const servidor = cargarServidor({ token });
  const http = createServer((peticion, respuesta) => {
    if (peticion.method === 'OPTIONS') {
      respuesta.writeHead(204, CABECERAS).end();
      return;
    }
    let cuerpo = '';
    peticion.on('data', (trozo) => { cuerpo += trozo; });
    peticion.on('end', () => {
      const salida = servidor.llamar(cuerpo);
      respuesta.writeHead(200, { ...CABECERAS, 'Content-Type': 'application/json' });
      respuesta.end(JSON.stringify(salida));
    });
  });
  await new Promise((resolver) => http.listen(0, '127.0.0.1', resolver));
  return {
    url: `http://127.0.0.1:${http.address().port}/exec`,
    token,
    hojas: servidor.sim.libro,
    ficheros: servidor.sim.ficheros,
    cerrar: () => new Promise((resolver) => http.close(resolver)),
  };
}
