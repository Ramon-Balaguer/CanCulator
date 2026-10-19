// Codificador PNG mínimo (RGB de 8 bits) sin dependencias.
import { deflateSync, crc32 } from 'node:zlib';

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

// rgb: ancho * alto * 3 bytes, fila a fila.
export function codificarPng(ancho, alto, rgb) {
  const filas = Buffer.alloc(alto * (1 + ancho * 3));
  for (let y = 0; y < alto; y++) {
    const inicio = y * (1 + ancho * 3);
    filas[inicio] = 0; // sin filtro
    Buffer.from(rgb.buffer, rgb.byteOffset + y * ancho * 3, ancho * 3).copy(filas, inicio + 1);
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(filas)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}
