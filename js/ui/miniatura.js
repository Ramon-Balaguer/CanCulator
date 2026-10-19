import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { leerFoto } from '../datos/tienda.js';

// Miniatura de la foto de un lote. Sin foto no ocupa sitio.
export function Miniatura({ db, fotoId }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!fotoId) return undefined;
    let vigente = true;
    let objeto = null;
    leerFoto(db, fotoId)
      .then((foto) => {
        if (!foto || !vigente) return;
        objeto = URL.createObjectURL(foto.blob);
        setUrl(objeto);
      })
      .catch(() => {});
    return () => {
      vigente = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [db, fotoId]);

  if (!fotoId) return null;
  return url
    ? html`<img class="miniatura" src=${url} alt="Foto del lote" />`
    : html`<span class="miniatura vacia" aria-hidden="true"></span>`;
}
