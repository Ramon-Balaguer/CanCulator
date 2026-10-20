// Dibujo de códigos de barras EAN-13, EAN-8 y UPC-A (12 dígitos, como EAN-13 con un 0 delante).
// Solo calcula los módulos (barras y espacios); el SVG lo pone la interfaz.
import { esGtinValido } from './codigo-barras.js';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
// Patrón de paridad del primer dígito del EAN-13 (L = izquierda, G = derecha).
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Devuelve los módulos como texto de 0 y 1 (1 = barra). Lanza si el código no es válido.
export function modulosCodigo(codigo) {
  const c = String(codigo ?? '');
  if (!/^\d+$/.test(c) || ![8, 12, 13].includes(c.length)) {
    throw new Error(`Código no dibujable: ${c}`);
  }
  if (!esGtinValido(c)) throw new Error(`Dígito de control incorrecto: ${c}`);

  if (c.length === 8) {
    const izq = [...c.slice(0, 4)].map((d) => L[Number(d)]).join('');
    const der = [...c.slice(4)].map((d) => R[Number(d)]).join('');
    return `101${izq}01010${der}101`;
  }
  const ean = c.length === 12 ? `0${c}` : c;
  const d = [...ean].map(Number);
  const paridad = PARIDAD[d[0]];
  let modulos = '101';
  for (let i = 1; i <= 6; i++) modulos += (paridad[i - 1] === 'L' ? L : G)[d[i]];
  modulos += '01010';
  for (let i = 7; i <= 12; i++) modulos += R[d[i]];
  return `${modulos}101`;
}
