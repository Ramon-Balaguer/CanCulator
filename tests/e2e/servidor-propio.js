// Arranca un servidor de la app solo para una prueba, para poder "cortar la red" de verdad
// parándolo. Es más fiel que context.setOffline(), que en WebKit corta las peticiones
// antes de que lleguen al service worker.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../scripts/servir.mjs', import.meta.url));

export async function servidorPropio() {
  const proceso = spawn(process.execPath, [SCRIPT], {
    env: { ...process.env, PUERTO: '0', BASE: '/inventario/' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resolver, rechazar) => {
    let salida = '';
    proceso.stdout.on('data', (trozo) => {
      salida += trozo;
      const encontrada = salida.match(/http:\/\/localhost:\d+\/inventario\//);
      if (encontrada) resolver(encontrada[0]);
    });
    proceso.once('exit', (codigo) => rechazar(new Error(`El servidor terminó (${codigo})`)));
  });
  const terminado = new Promise((resolver) => proceso.once('exit', resolver));
  return {
    url,
    // Se puede llamar varias veces.
    cortar: () => {
      if (proceso.exitCode === null && proceso.signalCode === null) proceso.kill();
      return terminado;
    },
  };
}
