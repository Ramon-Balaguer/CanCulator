import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLISHED } from '../../scripts/build.mjs';

const RAIZ = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Enlaces del README a los vídeos de docs/video.
function videosDelReadme(markdown) {
  return [...markdown.matchAll(/\]\((docs\/video\/[^)]+\.mp4)\)/g)].map((m) => m[1]);
}

test('el README enlaza los seis vídeos de presentación', async () => {
  const markdown = await readFile(join(RAIZ, 'README.md'), 'utf8');
  assert.equal(new Set(videosDelReadme(markdown)).size, 6);
});

test('cada vídeo enlazado existe en docs/video y no pasa de 50 MB', async () => {
  const markdown = await readFile(join(RAIZ, 'README.md'), 'utf8');
  for (const video of videosDelReadme(markdown)) {
    const ruta = join(RAIZ, video);
    assert.ok(existsSync(ruta), `falta ${video}`);
    assert.ok((await stat(ruta)).size < 50 * 1024 * 1024, `${video} pasa de 50 MB`);
  }
});

test('los vídeos no se publican en GitHub Pages', () => {
  assert.ok(!PUBLISHED.some((entrada) => entrada === 'docs' || entrada.startsWith('docs/')));
});
