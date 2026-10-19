// Dibuja códigos EAN-13 para las pruebas: como PNG (foto) y como vídeo Y4M (cámara simulada de Chromium).
import { codificarPng } from '../../scripts/png.mjs';

// Código de ejemplo con dígito de control válido.
export const CODIGO_PRUEBA = '4006381333931';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

// Devuelve los 95 módulos del EAN-13 como texto de 0 y 1 (1 = barra).
export function modulosEan13(codigo) {
  if (!/^\d{13}$/.test(codigo)) throw new Error(`EAN-13 no válido: ${codigo}`);
  const d = [...codigo].map(Number);
  const paridad = PARIDAD[d[0]];
  let modulos = '101';
  for (let i = 1; i <= 6; i++) modulos += (paridad[i - 1] === 'L' ? L : G)[d[i]];
  modulos += '01010';
  for (let i = 7; i <= 12; i++) modulos += R[d[i]];
  return modulos + '101';
}

// Imagen en escala de grises (0 negro, 255 blanco) con el código centrado.
export function imagenEan13(codigo, { ancho = 640, alto = 480, anchoModulo = 4, altoBarras = 300 } = {}) {
  const modulos = modulosEan13(codigo);
  const gris = new Uint8Array(ancho * alto).fill(255);
  const x0 = Math.floor((ancho - modulos.length * anchoModulo) / 2);
  const y0 = Math.floor((alto - altoBarras) / 2);
  for (let m = 0; m < modulos.length; m++) {
    if (modulos[m] !== '1') continue;
    for (let y = y0; y < y0 + altoBarras; y++) {
      gris.fill(0, y * ancho + x0 + m * anchoModulo, y * ancho + x0 + (m + 1) * anchoModulo);
    }
  }
  return { ancho, alto, gris };
}

export function pngEan13(codigo, opciones) {
  const { ancho, alto, gris } = imagenEan13(codigo, opciones);
  const rgb = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < gris.length; i++) rgb.fill(gris[i], i * 3, i * 3 + 3);
  return codificarPng(ancho, alto, rgb);
}

// Vídeo Y4M (YUV 4:2:0) con unos fotogramas iguales. Chromium lo repite en bucle.
export function y4mEan13(codigo, { fotogramas = 5, ...opciones } = {}) {
  const { ancho, alto, gris } = imagenEan13(codigo, opciones);
  const croma = Buffer.alloc((ancho / 2) * (alto / 2) * 2, 128);
  const partes = [Buffer.from(`YUV4MPEG2 W${ancho} H${alto} F10:1 Ip A1:1 C420jpeg\n`, 'ascii')];
  for (let i = 0; i < fotogramas; i++) {
    partes.push(Buffer.from('FRAME\n', 'ascii'), Buffer.from(gris), croma);
  }
  return Buffer.concat(partes);
}
