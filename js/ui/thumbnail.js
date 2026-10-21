import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { readPhoto } from '../datos/store.js';

// Thumbnail of a lot's photo. Without a photo it takes no space.
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

// Product image from Open Food Facts by default; if there is none, or it fails to load,
// the lot's own photo is shown instead.
export function ProductImage({ db, imageUrl, photoId }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  if (imageUrl && !failed) {
    return html`<img class="miniatura" src=${imageUrl} alt="Imagen del producto" loading="lazy" onError=${() => setFailed(true)} />`;
  }
  return html`<${Thumbnail} db=${db} fotoId=${photoId} />`;
}
