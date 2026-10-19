// Genera los iconos PNG de la app (una lata sobre fondo verde) sin dependencias.
// Uso: node scripts/generar-iconos.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const FONDO = [47, 107, 58];
const LATA = [236, 240, 236];
const BORDE = [190, 198, 192];
const ETIQUETA = [242, 184, 75];

function dentroElipse(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

// Color en coordenadas normalizadas (0..1).
function colorEn(x, y) {
  const izq = 0.32, der = 0.68, arriba = 0.27, abajo = 0.75;
  const cx = 0.5, rx = (der - izq) / 2, ry = 0.055;
  if (dentroElipse(x, y, cx, arriba, rx, ry)) {
    return dentroElipse(x, y, cx, arriba, rx * 0.85, ry * 0.7) ? BORDE : LATA;
  }
  const enCuerpo = x >= izq && x <= der && y >= arriba && y <= abajo;
  if (enCuerpo || dentroElipse(x, y, cx, abajo, rx, ry)) {
    if (y >= 0.42 && y <= 0.62 && enCuerpo) return ETIQUETA;
    return LATA;
  }
  return FONDO;
}

function png(tamano) {
  const sub = 4;
  const filas = [];
  for (let py = 0; py < tamano; py++) {
    const fila = Buffer.alloc(1 + tamano * 3);
    for (let px = 0; px < tamano; px++) {
      const suma = [0, 0, 0];
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const c = colorEn((px + (sx + 0.5) / sub) / tamano, (py + (sy + 0.5) / sub) / tamano);
          suma[0] += c[0]; suma[1] += c[1]; suma[2] += c[2];
        }
      }
      for (let i = 0; i < 3; i++) fila[1 + px * 3 + i] = Math.round(suma[i] / (sub * sub));
    }
    filas.push(fila);
  }
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(tamano, 0);
  cabecera.writeUInt32BE(tamano, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

for (const [nombre, tamano] of [['icono-192.png', 192], ['icono-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../icons/${nombre}`, import.meta.url), png(tamano));
  console.log(`icons/${nombre}`);
}
