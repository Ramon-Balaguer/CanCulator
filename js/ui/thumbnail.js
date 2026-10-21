import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { readPhoto } from '../datos/store.js';

// Miniatura de la foto de un lote. Sin foto no ocupa sitio.
export function Thumbnail({ db, fotoId }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!fotoId) return undefined;
    let valid = true;
    let object = null;
    readPhoto(db, fotoId)
      .then((photo) => {
        if (!photo || !valid) return;
        object = URL.createObjectURL(photo.blob);
        setUrl(object);
      })
      .catch(() => {});
    return () => {
      valid = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [db, fotoId]);

  if (!fotoId) return null;
  return url
    ? html`<img class="miniatura" src=${url} alt="Foto del lote" />`
    : html`<span class="miniatura vacia" aria-hidden="true"></span>`;
}
