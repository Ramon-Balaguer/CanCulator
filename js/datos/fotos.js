// Compresión de fotos en el navegador: JPEG de como mucho 1000 px en el lado mayor.
import { calcularTamano } from '../logica/imagen.js';

function cargarImagen(fichero) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(fichero);
    const img = new Image();
    img.onload = () => resolver({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la foto'));
    };
    img.src = url;
  });
}

export async function comprimirFoto(fichero, calidad = 0.8) {
  const { img, url } = await cargarImagen(fichero);
  try {
    const { ancho, alto } = calcularTamano(img.naturalWidth, img.naturalHeight);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext('2d').drawImage(img, 0, 0, ancho, alto);
    return await new Promise((resolver, rechazar) => {
      lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo comprimir la foto'))), 'image/jpeg', calidad);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
