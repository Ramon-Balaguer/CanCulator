// Starts an app server only for one test, so the network can be really "cut"
// products: all; lots: all; cacheOff: entries of the Open Food Facts cache.
// before they reach the service worker.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url));

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
    // It can be called several times.
    cortar: () => {
      if (childProcess.exitCode === null && childProcess.signalCode === null) childProcess.kill();
      return done;
    },
  };
}
