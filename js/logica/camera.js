// Camera constraints and messages, without touching the browser.

export const CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
});

export function cameraErrorMessage(error) {
  switch (error?.name) {
    case 'NotAllowedError':
      return 'Permiso de cámara denegado. Actívalo en los ajustes del navegador para esta web.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No se ha encontrado ninguna cámara.';
    case 'NotReadableError':
      return 'La cámara está ocupada por otra app. Ciérrala y vuelve a probar.';
    case 'SecurityError':
      return 'El navegador no permite usar la cámara en esta página (hace falta HTTPS).';
    default:
      return `No se pudo usar la cámara: ${error?.message || error?.name || 'error desconocido'}.`;
  }
}

// When reading a photo, any failure means no code was captured: the build
// minified ZXing renames its exceptions, so they are not told apart by name.
export const PHOTO_NO_CODE_MESSAGE = 'No se ha encontrado ningún código de barras en la imagen.';
