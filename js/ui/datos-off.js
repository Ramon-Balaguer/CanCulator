import { html } from 'htm/preact';
import { Modal } from './componentes.js';
import { imagenes, nutrientes, secciones, todosLosCampos } from '../logica/presentacion-off.js';

// Toda la información de un producto de Open Food Facts: resumen, secciones, nutrientes,
// fotos y la lista completa de campos. Todo el texto entra con textContent (Preact escapa).
export function DatosOFF({ codigo, producto, onCerrar }) {
  const grupos = secciones(producto);
  const tabla = nutrientes(producto);
  const fotos = imagenes(producto);
  const campos = todosLosCampos(producto);
  const enlace = `https://world.openfoodfacts.org/product/${codigo}`;

  return html`
    <${Modal} titulo="Open Food Facts" onCerrar=${onCerrar}>
      <div class="datos-off">
        <p class="datos-off-resumen">
          <strong>${producto.product_name || producto.brands || codigo}</strong>
          <span class="secundario">Código ${codigo}</span>
        </p>

        ${fotos.length > 0 && html`
          <div class="datos-off-fotos">
            ${fotos.map((f) => html`
              <figure>
                <img src=${f.url} alt=${`${f.etiqueta} del producto`} loading="lazy" />
                <figcaption>${f.etiqueta}</figcaption>
              </figure>`)}
          </div>`}

        ${grupos.map((g) => html`
          <section class="datos-off-seccion">
            <h3>${g.titulo}</h3>
            <dl class="datos-off-lista">
              ${g.filas.map((f) => html`<dt>${f.etiqueta}</dt><dd>${f.valor}</dd>`)}
            </dl>
          </section>`)}

        ${tabla.length > 0 && html`
          <section class="datos-off-seccion">
            <h3>Nutrientes por 100 g</h3>
            <table class="datos-off-tabla">
              <thead><tr><th>Nutriente</th><th>Valor</th></tr></thead>
              <tbody>
                ${tabla.map((n) => html`<tr><td>${n.nombre}</td><td>${n.valor} ${n.unidad}</td></tr>`)}
              </tbody>
            </table>
          </section>`}

        <details class="datos-off-todos">
          <summary>Todos los campos (${campos.length})</summary>
          <dl class="datos-off-lista">
            ${campos.map((c) => html`<dt>${c.clave}</dt><dd>${c.valor || '—'}</dd>`)}
          </dl>
        </details>

        <p class="datos-off-pie">
          <a href=${enlace} target="_blank" rel="noopener noreferrer">Ver en Open Food Facts</a>
          · Datos de <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, licencia ODbL.
        </p>
      </div>
    <//>
  `;
}
