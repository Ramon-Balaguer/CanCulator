// Draws EAN-13 codes for the tests: as PNG (photo) and as Y4M video (simulated Chromium camera).
import { encodePng } from '../../scripts/png.mjs';

// Example code with a valid check digit.
export const TEST_CODE = '4006381333931';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Returns the 95 modules of the EAN-13 as text of 0 and 1 (1 = bar).
export function modulesEan13(code) {
  if (!/^\d{13}$/.test(code)) throw new Error(`EAN-13 no válido: ${code}`);
  const d = [...code].map(Number);
  const parity = PARITY[d[0]];
  let modules = '101';
  for (let i = 1; i <= 6; i++) modules += (parity[i - 1] === 'L' ? L : G)[d[i]];
  modules += '01010';
  for (let i = 7; i <= 12; i++) modules += R[d[i]];
  return modules + '101';
}

// Grayscale image (0 black, 255 white) with the code centered.
export function ean13Image(code, { ancho: width = 640, alto: height = 480, anchoModulo = 4, altoBarras = 300 } = {}) {
  const modules = modulesEan13(code);
  const gray = new Uint8Array(width * height).fill(255);
  const x0 = Math.floor((width - modules.length * anchoModulo) / 2);
  const y0 = Math.floor((height - altoBarras) / 2);
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] !== '1') continue;
    for (let y = y0; y < y0 + altoBarras; y++) {
      gray.fill(0, y * width + x0 + m * anchoModulo, y * width + x0 + (m + 1) * anchoModulo);
    }
  }
  return { ancho: width, alto: height, gris: gray };
}

export function pngEan13(code, options) {
  const { ancho: width, alto: height, gris: gray } = ean13Image(code, options);
  const rgb = Buffer.alloc(width * height * 3);
  for (let i = 0; i < gray.length; i++) rgb.fill(gray[i], i * 3, i * 3 + 3);
  return encodePng(width, height, rgb);
}

// Y4M video (YUV 4:2:0) with some identical frames. Chromium loops it.
export function y4mEan13(code, { fotogramas = 5, ...options } = {}) {
  const { ancho: width, alto: height, gris: gray } = ean13Image(code, options);
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
  const parts = [Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`, 'ascii')];
  for (let i = 0; i < fotogramas; i++) {
    parts.push(Buffer.from('FRAME\n', 'ascii'), Buffer.from(gray), chroma);
  }
  return Buffer.concat(parts);
}
