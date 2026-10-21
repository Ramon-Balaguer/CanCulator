// Compresión de fotos en el navegador: JPEG de como mucho 1000 px en el lado mayor.
import { computeSize } from '../logica/image.js';

function loadImage(uploadedFile) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(uploadedFile);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la foto'));
    };
    img.src = url;
  });
}

export async function compressPhoto(uploadedFile, calidad = 0.8) {
  const { img, url } = await loadImage(uploadedFile);
  try {
    const { ancho: width, alto: height } = computeSize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la foto'))), 'image/jpeg', calidad);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
