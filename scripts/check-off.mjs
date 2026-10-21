// Consulta real a Open Food Facts con códigos conocidos. No corre en CI (depende de la red).
// Uso: node scripts/check-off.mjs
import { parseResponse, productUrl } from '../js/logica/openfoodfacts.js';

const CASES = [
  { codigo: '3229820129488', esperado: { encontrado: true, nombre: 'muesli raisin,datte,figue', marca: 'Bjorg' } },
  { codigo: '2012345678903', esperado: { encontrado: false } },
];

let failures = 0;
for (const { codigo: code, esperado } of CASES) {
  const response = await fetch(productUrl(code), { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);
  const real = parseResponse(response.status, body);
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FALLO'} ${code} HTTP ${response.status} → ${JSON.stringify(real)}`);
}
process.exit(failures ? 1 : 0);
