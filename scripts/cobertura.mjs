// Corre los unitarios y los e2e recogiendo cobertura, y luego el informe combinado.
// Uso: npm run test:cobertura
import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
rmSync(join(RAIZ, 'coverage'), { recursive: true, force: true });

function correr(orden, entorno) {
  const r = spawnSync(orden, {
    cwd: RAIZ,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, ...entorno },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

correr('npm run test:unit', { NODE_V8_COVERAGE: join(RAIZ, 'coverage', 'v8-unit') });
correr('npx playwright test', { COBERTURA: '1' });
correr('node scripts/informe-cobertura.mjs', {});
