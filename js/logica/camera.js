// Camera constraints and messages, without touching the browser.
import { t } from './idioma.js';

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
      return t('camara.permiso');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return t('camara.no_encontrada');
    case 'NotReadableError':
      return t('camara.ocupada');
    case 'SecurityError':
      return t('camara.https');
    default:
      return t('camara.otro', { error: error?.message || error?.name || t('camara.error_desconocido') });
  }
}

// When reading a photo, any failure means no code was captured: the build
// minified ZXing renames its exceptions, so they are not told apart by name.
export function photoNoCodeMessage() {
  return t('camara.sin_codigo_foto');
}
