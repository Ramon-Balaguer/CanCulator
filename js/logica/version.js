export const MARCADOR_VERSION = '__COMMIT__';

// Texto que se enseña al usuario: el hash corto, o "desarrollo" si no se ha desplegado.
export function textoVersion(version) {
  if (!version || version === MARCADOR_VERSION) return 'desarrollo';
  return version.slice(0, 7);
}

// Sustituye el marcador por el hash del commit. Falla si el hash no es válido
// o si el texto no contiene el marcador, para que el despliegue no pase en silencio.
export function inyectarVersion(texto, hash) {
  if (!/^[0-9a-f]{7,40}$/.test(hash)) {
    throw new Error(`Hash de commit no válido: ${hash}`);
  }
  if (!texto.includes(MARCADOR_VERSION)) {
    throw new Error('El fichero no contiene el marcador de versión');
  }
  return texto.replaceAll(MARCADOR_VERSION, hash);
}
