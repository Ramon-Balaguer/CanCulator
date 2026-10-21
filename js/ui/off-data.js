import { html } from 'htm/preact';
import { Modal } from './components.js';
import { images, nutrients, sections, allFields } from '../logica/off-presentation.js';

// Full product information from Open Food Facts: summary, sections, nutrients, photos,
// front, back, and details. All the text enters with textContent (Preact escapes it).
export function OFFData({ codigo: code, producto: product, onCerrar }) {
  const groups = sections(product);
  const table = nutrients(product);
  const photos = images(product);
  const fields = allFields(product);
  const link = `https://world.openfoodfacts.org/product/${code}`;

  return html`
    <${Modal} titulo="Open Food Facts" onCerrar=${onCerrar}>
      <div class="datos-off">
        <p class="datos-off-resumen">
          <strong>${product.product_name || product.brands || code}</strong>
          <span class="secundario">Código ${code}</span>
        </p>

        ${photos.length > 0 && html`
          <div class="datos-off-fotos">
            ${photos.map((f) => html`
              <figure>
                <img src=${f.url} alt=${`${f.etiqueta} del producto`} loading="lazy" />
                <figcaption>${f.etiqueta}</figcaption>
              </figure>`)}
          </div>`}

        ${groups.map((g) => html`
          <section class="datos-off-seccion">
            <h3>${g.titulo}</h3>
            <dl class="datos-off-lista">
              ${g.filas.map((f) => html`<dt>${f.etiqueta}</dt><dd>${f.valor}</dd>`)}
            </dl>
          </section>`)}

        ${table.length > 0 && html`
          <section class="datos-off-seccion">
            <h3>Nutrientes por 100 g</h3>
            <table class="datos-off-tabla">
              <thead><tr><th>Nutriente</th><th>Valor</th></tr></thead>
              <tbody>
                ${table.map((n) => html`<tr><td>${n.nombre}</td><td>${n.valor} ${n.unidad}</td></tr>`)}
              </tbody>
            </table>
          </section>`}

        <details class="datos-off-todos">
          <summary>Todos los campos (${fields.length})</summary>
          <dl class="datos-off-lista">
            ${fields.map((c) => html`<dt>${c.clave}</dt><dd>${c.valor || '—'}</dd>`)}
          </dl>
        </details>

        <p class="datos-off-pie">
          <a href=${link} target="_blank" rel="noopener noreferrer">Ver en Open Food Facts</a>
          · Datos de <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>, licencia ODbL.
        </p>
      </div>
    <//>
  `;
}
