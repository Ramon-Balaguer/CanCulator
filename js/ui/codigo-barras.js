import { html } from 'htm/preact';
import { modulosCodigo } from '../logica/ean.js';

const ZONA_SILENCIO = 7; // módulos en blanco a cada lado, como exige el estándar
const ALTO_BARRAS = 60;
const ALTO_TEXTO = 12;

// Código de barras como SVG vectorial (se imprime nítido). Si el código no se puede
// dibujar, se muestra solo el número.
export function CodigoBarras({ codigo }) {
  let modulos;
  try {
    modulos = modulosCodigo(codigo);
  } catch {
    return html`<span class="secundario">${codigo || '—'}</span>`;
  }

  // Un solo trazo con un rectángulo por cada tramo de barras seguidas.
  let trazo = '';
  let x = ZONA_SILENCIO;
  for (let i = 0; i < modulos.length; i++) {
    if (modulos[i] !== '1') { x++; continue; }
    let ancho = 0;
    while (modulos[i + ancho] === '1') ancho++;
    trazo += `M${x} 0h${ancho}v${ALTO_BARRAS}h-${ancho}z`;
    x += ancho;
    i += ancho - 1;
  }

  const ancho = modulos.length + ZONA_SILENCIO * 2;
  return html`
    <svg class="codigo-barras" viewBox=${`0 0 ${ancho} ${ALTO_BARRAS + ALTO_TEXTO}`} role="img" aria-label=${`Código de barras ${codigo}`}>
      <path d=${trazo} fill="#000" />
      <text x=${ancho / 2} y=${ALTO_BARRAS + ALTO_TEXTO - 2} text-anchor="middle" font-size="10" font-family="monospace">${codigo}</text>
    </svg>
  `;
}
