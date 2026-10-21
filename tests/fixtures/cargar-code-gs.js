// Carga apps-script/Code.gs en un contexto de Node con las APIs simuladas.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createAppsEnv } from './hoja-simulada.js';

export function loadServer({ token = 'secreto-de-prueba' } = {}) {
  const sim = createAppsEnv();
  sim.propiedades.set('TOKEN', token);
  const code = readFileSync(new URL('../../apps-script/Code.gs', import.meta.url), 'utf8');
  const context = vm.createContext({ ...sim.entorno, JSON, Set, Object, Math, Number, String, Date, Array, console });
  vm.runInContext(code, context, { filename: 'Code.gs' });
  const call = (request) => {
    const body = typeof request === 'string' ? request : JSON.stringify(request);
    context.__cuerpo = body;
    const output = vm.runInContext('doPost({ postData: { contents: __cuerpo } })', context);
    return JSON.parse(output.texto);
  };
  return { llamar: call, sim, contexto: context };
}
