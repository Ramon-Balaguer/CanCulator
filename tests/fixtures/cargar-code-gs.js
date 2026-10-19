// Carga apps-script/Code.gs en un contexto de Node con las APIs simuladas.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { crearEntornoApps } from './hoja-simulada.js';

export function cargarServidor({ token = 'secreto-de-prueba' } = {}) {
  const sim = crearEntornoApps();
  sim.propiedades.set('TOKEN', token);
  const codigo = readFileSync(new URL('../../apps-script/Code.gs', import.meta.url), 'utf8');
  const contexto = vm.createContext({ ...sim.entorno, JSON, Set, Object, Math, Number, String, Date, Array, console });
  vm.runInContext(codigo, contexto, { filename: 'Code.gs' });
  const llamar = (peticion) => {
    const cuerpo = typeof peticion === 'string' ? peticion : JSON.stringify(peticion);
    contexto.__cuerpo = cuerpo;
    const salida = vm.runInContext('doPost({ postData: { contents: __cuerpo } })', contexto);
    return JSON.parse(salida.texto);
  };
  return { llamar, sim, contexto };
}
