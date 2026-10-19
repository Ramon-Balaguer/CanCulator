// Consulta real a Open Food Facts con códigos conocidos. No corre en CI (depende de la red).
// Uso: node scripts/comprobar-off.mjs
import { interpretarRespuesta, urlProducto } from '../js/logica/openfoodfacts.js';

const CASOS = [
  { codigo: '3229820129488', esperado: { encontrado: true, nombre: 'muesli raisin,datte,figue', marca: 'Bjorg' } },
  { codigo: '2012345678903', esperado: { encontrado: false } },
];

let fallos = 0;
for (const { codigo, esperado } of CASOS) {
  const respuesta = await fetch(urlProducto(codigo), { headers: { Accept: 'application/json' } });
  const cuerpo = await respuesta.json().catch(() => null);
  const real = interpretarRespuesta(respuesta.status, cuerpo);
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${codigo} HTTP ${respuesta.status} → ${JSON.stringify(real)}`);
}
process.exit(fallos ? 1 : 0);
