import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { readPhoto } from '../datos/store.js';

// Thumbnail of a lot's photo. Without a photo it takes no space.
export function Thumbnail({ db, fotoId }) {
  const [url, setUrl] = useState(null);
  const [version, setVersion] = useState(0);

  // The photo can arrive from another phone after the lot is already on screen.
  useEffect(() => {
    if (!fotoId) return undefined;
    const alLlegar = (event) => {
      if (event.detail === fotoId) setVersion((v) => v + 1);
    };
    globalThis.addEventListener('foto-recibida', alLlegar);
    return () => globalThis.removeEventListener('foto-recibida', alLlegar);
  }, [fotoId]);

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
  }, [db, fotoId, version]);

  if (!fotoId) return null;
  return url
    ? html`<img class="miniatura" src=${url} alt="Foto del lote" />`
    : html`<span class="miniatura vacia" aria-hidden="true"></span>`;
}

// Product image from Open Food Facts, kept in the local database (so it works offline);
// without it, the lot's own photo is shown.
export function ProductImage({ db, offFotoId, photoId }) {
  return html`<${Thumbnail} db=${db} fotoId=${offFotoId || photoId} />`;
}
