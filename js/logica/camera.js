// Restricciones y mensajes de la cámara, sin tocar el navegador.

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

// Al leer una foto, cualquier fallo significa que no se ha sacado un código: la build
// minificada de ZXing renombra sus excepciones, así que no se distinguen por nombre.
export const PHOTO_NO_CODE_MESSAGE = 'No se ha encontrado ningún código de barras en la imagen.';
