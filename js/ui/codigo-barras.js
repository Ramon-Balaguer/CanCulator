import { html } from 'htm/preact';
import { modulesOfCode } from '../logica/ean.js';

const QUIET_ZONE = 7; // módulos en blanco a cada lado, como exige el estándar
const BAR_HEIGHT = 60;
const TEXT_HEIGHT = 12;

// Código de barras como SVG vectorial (se imprime nítido). Si el código no se puede
// dibujar, se muestra solo el número.
export function Barcode({ codigo: code }) {
  let modules;
  try {
    modules = modulesOfCode(code);
  } catch {
    return html`<span class="secundario">${code || '—'}</span>`;
  }

  // Un solo trazo con un rectángulo por cada tramo de barras seguidas.
  let path = '';
  let x = QUIET_ZONE;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] !== '1') { x++; continue; }
    let width = 0;
    while (modules[i + width] === '1') width++;
    path += `M${x} 0h${width}v${BAR_HEIGHT}h-${width}z`;
    x += width;
    i += width - 1;
  }

  const width = modules.length + QUIET_ZONE * 2;
  return html`
    <svg class="codigo-barras" viewBox=${`0 0 ${width} ${BAR_HEIGHT + TEXT_HEIGHT}`} role="img" aria-label=${`Código de barras ${code}`}>
      <path d=${path} fill="#000" />
      <text x=${width / 2} y=${BAR_HEIGHT + TEXT_HEIGHT - 2} text-anchor="middle" font-size="10" font-family="monospace">${code}</text>
    </svg>
  `;
}
