import { html } from 'htm/preact';
import { useEffect, useRef } from 'preact/hooks';

let modalesCreados = 0;

export function Boton({ tipo = 'primario', className = '', ...props }) {
  const clase = `boton ${tipo === 'primario' ? '' : tipo} ${className}`.trim();
  return html`<button type="button" class=${clase} ...${props} />`;
}

export function Modal({ titulo, onCerrar, children }) {
  const ref = useRef(null);
  const idTitulo = useRef(null);
  idTitulo.current ??= `modal-titulo-${++modalesCreados}`;
  useEffect(() => {
    ref.current?.showModal?.();
    return () => ref.current?.close?.();
  }, []);
  return html`
    <dialog ref=${ref} class="modal" aria-labelledby=${idTitulo.current} onCancel=${(e) => { e.preventDefault(); onCerrar(); }}>
      <div class="modal-cabecera">
        <h2 id=${idTitulo.current}>${titulo}</h2>
        <button type="button" class="boton secundario pequeno" onClick=${onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-cuerpo">${children}</div>
    </dialog>
  `;
}

export function Campo({ etiqueta, children, ayuda }) {
  return html`
    <label class="campo">
      <span class="campo-etiqueta">${etiqueta}</span>
      ${children}
      ${ayuda && html`<span class="campo-ayuda">${ayuda}</span>`}
    </label>
  `;
}

export function Aviso({ tipo = 'info', children }) {
  if (!children) return null;
  return html`<p class=${`aviso ${tipo}`} role=${tipo === 'error' ? 'alert' : 'status'}>${children}</p>`;
}

export function Vacio({ children }) {
  return html`<p class="vacio">${children}</p>`;
}
