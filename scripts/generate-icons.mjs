// Genera los iconos PNG de la app (una lata sobre fondo verde) sin dependencias.
// Uso: node scripts/generate-icons.mjs
import { encodePng } from './png.mjs';
import { writeFileSync } from 'node:fs';

const BACKGROUND = [47, 107, 58];
const CAN = [236, 240, 236];
const BORDER = [190, 198, 192];
const LABEL = [242, 184, 75];

function insideEllipse(x, y, cx, cy, rx, ry) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
}

// Color en coordenadas normalizadas (0..1).
function colorAt(x, y) {
  const left = 0.32, right = 0.68, up = 0.27, down = 0.75;
  const cx = 0.5, rx = (right - left) / 2, ry = 0.055;
  if (insideEllipse(x, y, cx, up, rx, ry)) {
    return insideEllipse(x, y, cx, up, rx * 0.85, ry * 0.7) ? BORDER : CAN;
  }
  const inBody = x >= left && x <= right && y >= up && y <= down;
  if (inBody || insideEllipse(x, y, cx, down, rx, ry)) {
    if (y >= 0.42 && y <= 0.62 && inBody) return LABEL;
    return CAN;
  }
  return BACKGROUND;
}

function png(size) {
  const sub = 4;
  const rgb = Buffer.alloc(size * size * 3);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const c = colorAt((px + (sx + 0.5) / sub) / size, (py + (sy + 0.5) / sub) / size);
          sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        }
      }
      for (let i = 0; i < 3; i++) rgb[(py * size + px) * 3 + i] = Math.round(sum[i] / (sub * sub));
    }
  }
  return encodePng(size, size, rgb);
}

for (const [name, size] of [['icono-192.png', 192], ['icono-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../icons/${name}`, import.meta.url), png(size));
  console.log(`icons/${name}`);
}
