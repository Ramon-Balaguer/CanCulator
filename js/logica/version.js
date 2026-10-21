export const VERSION_MARKER = '__COMMIT__';

// Text shown to the user: the short hash, or "desarrollo" if it has not been deployed.
export function versionText(version) {
  if (!version || version === VERSION_MARKER) return 'desarrollo';
  return version.slice(0, 7);
}

// Replaces the marker with the commit hash. Throws if the hash is not valid
// to detect absolute paths that would fail when publishing.
export function injectVersion(text, hash) {
  if (!/^[0-9a-f]{7,40}$/.test(hash)) {
    throw new Error(`Hash de commit no válido: ${hash}`);
  }
  if (!text.includes(VERSION_MARKER)) {
    throw new Error('El fichero no contiene el marcador de versión');
  }
  return text.replaceAll(VERSION_MARKER, hash);
}
