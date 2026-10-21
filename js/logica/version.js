export const VERSION_MARKER = '__COMMIT__';

// Texto que se enseña al usuario: el hash corto, o "desarrollo" si no se ha desplegado.
export function versionText(version) {
  if (!version || version === VERSION_MARKER) return 'desarrollo';
  return version.slice(0, 7);
}

// Sustituye el marcador por el hash del commit. Falla si el hash no es válido
// o si el texto no contiene el marcador, para que el despliegue no pase en silencio.
export function injectVersion(text, hash) {
  if (!/^[0-9a-f]{7,40}$/.test(hash)) {
    throw new Error(`Hash de commit no válido: ${hash}`);
  }
  if (!text.includes(VERSION_MARKER)) {
    throw new Error('El fichero no contiene el marcador de versión');
  }
  return text.replaceAll(VERSION_MARKER, hash);
}
