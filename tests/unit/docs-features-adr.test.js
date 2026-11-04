import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const RAIZ = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DOCS = join(RAIZ, 'docs');

const SECCIONES_ADR = ['## Estado', '## Contexto', '## Decisión', '## Consecuencias'];

async function ficheros(carpeta) {
  return (await readdir(join(DOCS, carpeta))).filter((f) => f.endsWith('.md')).sort();
}

test('docs/features tiene una página por feature, con título', async () => {
  const paginas = await ficheros('features');
  assert.ok(paginas.length >= 10, `solo ${paginas.length} features documentadas`);
  for (const pagina of paginas) {
    const texto = await readFile(join(DOCS, 'features', pagina), 'utf8');
    assert.match(texto, /^# .+/m, `${pagina} no tiene título`);
  }
});

test('cada ADR tiene número, estado, contexto, decisión y consecuencias', async () => {
  const adrs = await ficheros('adr');
  assert.ok(adrs.length >= 8, `solo ${adrs.length} ADR documentados`);
  for (const adr of adrs) {
    assert.match(adr, /^\d{4}-[a-z0-9-]+\.md$/, `nombre de ADR no válido: ${adr}`);
    const texto = await readFile(join(DOCS, 'adr', adr), 'utf8');
    for (const seccion of SECCIONES_ADR) assert.ok(texto.includes(seccion), `${adr} sin «${seccion}»`);
  }
});

test('el índice de docs enlaza todas las features y todos los ADR', async () => {
  const indice = await readFile(join(DOCS, 'README.md'), 'utf8');
  for (const pagina of await ficheros('features')) {
    assert.ok(indice.includes(`features/${pagina}`), `el índice no enlaza features/${pagina}`);
  }
  for (const adr of await ficheros('adr')) {
    assert.ok(indice.includes(`adr/${adr}`), `el índice no enlaza adr/${adr}`);
  }
});
