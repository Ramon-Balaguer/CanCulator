// Junta la cobertura V8 de los unitarios (coverage/v8-unit) y de los e2e (coverage/v8-e2e)
// sobre el código de la app (js/**), la pasa a formato istanbul e imprime el informe.
// Sale con error si la cobertura de líneas baja del umbral (por defecto 90 %).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import V8ToIstanbul from 'v8-to-istanbul';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CARPETA_APP = join(RAIZ, 'js');
const UMBRAL = Number(process.env.UMBRAL_COBERTURA ?? 90);
const SALIDA = join(RAIZ, 'coverage', 'informe');

function jsonsEn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f));
}

// Del URL de un script a la ruta local de la app, o null si no es código de js/.
function rutaLocal(url) {
  if (!/^(file:|https?:)/.test(url)) return null;
  let ruta;
  if (url.startsWith('file:')) {
    ruta = fileURLToPath(url);
  } else {
    const trozo = new URL(url).pathname.replace(/^\/inventario\//, '');
    ruta = join(RAIZ, ...trozo.split('/'));
  }
  const rel = relative(CARPETA_APP, ruta);
  return rel.startsWith('..') || rel.startsWith(sep) || !rel.endsWith('.js') ? null : resolve(ruta);
}

// Cada entrada: { url, functions, source? }
function entradas() {
  const lista = [];
  for (const archivo of jsonsEn(join(RAIZ, 'coverage', 'v8-unit'))) {
    for (const script of JSON.parse(readFileSync(archivo, 'utf8')).result) {
      lista.push(script);
    }
  }
  for (const archivo of jsonsEn(join(RAIZ, 'coverage', 'v8-e2e'))) {
    lista.push(...JSON.parse(readFileSync(archivo, 'utf8')));
  }
  return lista;
}

const mapa = libCoverage.createCoverageMap({});
let scripts = 0;
for (const entrada of entradas()) {
  const ruta = rutaLocal(entrada.url);
  if (!ruta || !statSync(ruta, { throwIfNoEntry: false })) continue;
  const fuente = entrada.source ?? readFileSync(ruta, 'utf8');
  const conversor = new V8ToIstanbul(ruta, 0, { source: fuente });
  await conversor.load();
  conversor.applyCoverage(entrada.functions);
  mapa.merge(conversor.toIstanbul());
  scripts += 1;
}

const contexto = libReport.createContext({ dir: SALIDA, coverageMap: mapa });
reports.create('text').execute(contexto);
reports.create('html').execute(contexto);
reports.create('json').execute(contexto);

const resumen = mapa.getCoverageSummary();
const pct = resumen.lines.pct;
console.log(`\nScripts de app analizados: ${scripts}. Líneas ${pct}% (umbral ${UMBRAL}%). Informe HTML: ${join(SALIDA, 'index.html')}`);
if (pct < UMBRAL) {
  console.error(`La cobertura de líneas (${pct}%) está por debajo del ${UMBRAL}%.`);
  process.exit(1);
}
