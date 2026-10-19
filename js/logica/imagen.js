// Tamaño de salida al comprimir una foto: el lado mayor como mucho LADO_MAXIMO píxeles.

export const LADO_MAXIMO = 1000;

export function calcularTamano(ancho, alto, maximo = LADO_MAXIMO) {
  if (!(ancho > 0) || !(alto > 0)) throw new Error('La imagen no tiene dimensiones válidas');
  const escala = Math.min(1, maximo / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}
