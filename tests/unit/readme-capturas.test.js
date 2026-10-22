import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Todas las imágenes de docs/img que aparecen en el README, con sus atributos width/height.
function capturasDelReadme(markdown) {
  const etiquetas = markdown.match(/<img\b[^>]*src="docs\/img\/[^"]+"[^>]*>/g) ?? [];
  return etiquetas.map((etiqueta) => ({
    src: etiqueta.match(/src="([^"]+)"/)[1],
    width: etiqueta.match(/\swidth="([^"]+)"/)?.[1],
    height: etiqueta.match(/\sheight="([^"]+)"/)?.[1],
  }));
}

test('el README muestra al menos una captura', async () => {
  const markdown = await readFile(join(RAIZ, 'README.md'), 'utf8');
  assert.ok(capturasDelReadme(markdown).length >= 6);
});

test('todas las capturas del README tienen el mismo ancho y alto', async () => {
  const markdown = await readFile(join(RAIZ, 'README.md'), 'utf8');
  const capturas = capturasDelReadme(markdown);
  const medidas = new Set(capturas.map((c) => `${c.width}x${c.height}`));
  assert.deepEqual([...medidas].filter((m) => !m.includes('undefined')), [...medidas]);
  assert.equal(medidas.size, 1, `tamaños distintos: ${[...medidas].join(', ')}`);
});

test('cada captura referenciada existe en docs/img', async () => {
  const markdown = await readFile(join(RAIZ, 'README.md'), 'utf8');
  for (const { src } of capturasDelReadme(markdown)) {
    assert.ok(existsSync(join(RAIZ, src)), `falta ${src}`);
  }
});
