import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../logica/idioma.js';

let modalCount = 0;

export function Button({ tipo: type = 'primario', className = '', ...props }) {
  const cls = `boton ${type === 'primario' ? '' : type} ${className}`.trim();
  return html`<button type="button" class=${cls} ...${props} />`;
}

export function Modal({ titulo, onCerrar, children }) {
  const ref = useRef(null);
  const titleId = useRef(null);
  titleId.current ??= `modal-titulo-${++modalCount}`;
  useEffect(() => {
    ref.current?.showModal?.();
    return () => ref.current?.close?.();
  }, []);
  return html`
    <dialog ref=${ref} class="modal" aria-labelledby=${titleId.current} onCancel=${(e) => { e.preventDefault(); onCerrar(); }}>
      <div class="modal-cabecera">
        <h2 id=${titleId.current}>${titulo}</h2>
        <button type="button" class="boton secundario pequeno" onClick=${onCerrar} aria-label=${t('btn.cerrar')}>✕</button>
      </div>
      <div class="modal-cuerpo">${children}</div>
    </dialog>
  `;
}

export function Field({ etiqueta, children, ayuda }) {
  return html`
    <label class="campo">
      <span class="campo-etiqueta">${etiqueta}</span>
      ${children}
      ${ayuda && html`<span class="campo-ayuda">${ayuda}</span>`}
    </label>
  `;
}

export function Notice({ tipo: type = 'info', children }) {
  if (!children) return null;
  return html`<p class=${`aviso ${type}`} role=${type === 'error' ? 'alert' : 'status'}>${children}</p>`;
}

export function Empty({ children }) {
  return html`<p class="vacio">${children}</p>`;
}
