// Arranca un servidor de la app solo para una prueba, para poder "cortar la red" de verdad
// parándolo. Es más fiel que context.setOffline(), que en WebKit corta las peticiones
// antes de que lleguen al service worker.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../scripts/servir.mjs', import.meta.url));

export async function ownServer() {
  const childProcess = spawn(process.execPath, [SCRIPT], {
    env: { ...process.env, PUERTO: '0', BASE: '/inventario/' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    childProcess.stdout.on('data', (chunk) => {
      output += chunk;
      const found = output.match(/http:\/\/localhost:\d+\/inventario\//);
      if (found) resolve(found[0]);
    });
    childProcess.once('exit', (code) => reject(new Error(`El servidor terminó (${code})`)));
  });
  const done = new Promise((resolve) => childProcess.once('exit', resolve));
  return {
    url,
    // Se puede llamar varias veces.
    cortar: () => {
      if (childProcess.exitCode === null && childProcess.signalCode === null) childProcess.kill();
      return done;
    },
  };
}
