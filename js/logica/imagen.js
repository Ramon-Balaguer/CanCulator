// Tamaño de salida al comprimir una foto: el lado mayor como mucho LADO_MAXIMO píxeles.

export const MAX_SIDE = 1000;

export function computeSize(width, height, maximo = MAX_SIDE) {
  if (!(width > 0) || !(height > 0)) throw new Error('La imagen no tiene dimensiones válidas');
  const scale = Math.min(1, maximo / Math.max(width, height));
  return {
    ancho: Math.max(1, Math.round(width * scale)),
    alto: Math.max(1, Math.round(height * scale)),
  };
}
