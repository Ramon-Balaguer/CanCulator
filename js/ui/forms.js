import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { Notice, Button, Field, Modal } from './components.js';
import { ScannerModal } from './scanner.js';
import { addLot, removeLot, removeProduct, consume, createProduct, editLot, editProduct, savePhoto } from '../datos/store.js';
import { compressPhoto } from '../datos/photos.js';
import { findSameLot, findProductByCode, findProductByName, lotsToConsume, photoIdOf } from '../logica/inventory.js';
import { isValidGtin } from '../logica/barcode.js';
import { todayInMadrid, formatDate, daysBetween, describeExpiry, formatDateInput, parseTypedDate } from '../logica/dates.js';
import { Thumbnail } from './thumbnail.js';
import { queryOFF, STATES, readCacheOFF } from '../datos/off.js';
import { OFFData } from './off-data.js';
import { guessCategory, frontImageUrl } from '../logica/off-category.js';
import { nutritionDataFromOFF, kcalPerContainer, storedKcalPerContainer } from '../logica/nutrition.js';

const EMPTY_FIELDS = () => ({
  codigo: '',
  nombre: '',
  categoria: '',
  ubicacion: '',
  caducidad: '',
  cantidad: '1',
  foto: null,
});

// Lot form. If productoInicial arrives (from Restock), it is preselected.
export function LotForm({ db, dispositivo: device, datos: data, config, productoInicial, onHecho, onCancelar, notificar: notifyUser }) {
  const [fields, setCampos] = useState(() => {
    const start = EMPTY_FIELDS();
    if (productoInicial) {
      start.nombre = productoInicial.nombre;
      start.categoria = productoInicial.categoria;
      start.codigo = productoInicial.codigo_barras ?? '';
    }
    start.ubicacion = config.ubicaciones[0] ?? '';
    start.categoria = start.categoria || (config.categorias[0] ?? '');
    return start;
  });
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [notice, setAviso] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [ofProducto, setOfProducto] = useState(null);
  const [verOFF, setVerOFF] = useState(false);

  const change = (key) => (event) => setCampos({ ...fields, [key]: event.currentTarget.value });

  useEffect(() => {
    if (!fields.foto) { setPrevia(null); return undefined; }
    const url = URL.createObjectURL(fields.foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [fields.foto]);

  // After scanning: if there is already a product, it is used; if not, Open Food Facts is asked ONCE.
  // A failure never blocks the entry: the name stays editable by hand.
  async function onScanned(code) {
    setEscaneando(false);
    setAviso(null);
    const existing = findProductByCode(data.productos, code);
    setCampos((c) => ({
      ...c,
      codigo: code,
      nombre: existing?.nombre ?? c.nombre,
      categoria: existing?.categoria ?? c.categoria,
    }));
    if (existing) {
      setAviso({ tipo: 'info', texto: `Ya tienes «${existing.nombre}». Revisa los datos del lote.` });
      return;
    }
    if (!isValidGtin(code)) {
      setAviso({ tipo: 'error', texto: 'El código no tiene un dígito de control válido. Escribe el nombre a mano.' });
      return;
    }
    setConsultando(true);
    try {
      const r = await queryOFF(db, code);
      if (r.estado === STATES.ENCONTRADO) {
        setOfProducto(r.producto ?? null);
        const guessed = guessCategory(r.producto, config.categorias);
        setCampos((c) => ({
          ...c,
          nombre: c.nombre.trim() ? c.nombre : r.nombre,
          categoria: guessed || c.categoria,
        }));
        const brand = r.marca && r.marca !== r.nombre ? ` (${r.marca})` : '';
        const category = guessed ? ` Categoría sugerida: ${guessed}.` : '';
        setAviso({ tipo: 'info', texto: `Open Food Facts: ${r.nombre}${brand}.${category} Revisa los datos antes de guardar.` });
        downloadFrontPhoto(r.producto);
      } else if (r.estado === STATES.NO_ENCONTRADO) {
        setAviso({ tipo: 'info', texto: 'No está en Open Food Facts. Escribe el nombre a mano.' });
      } else if (r.estado === STATES.SIN_CONEXION) {
        setAviso({ tipo: 'info', texto: 'Sin conexión: escribe el nombre a mano.' });
      } else {
        setAviso({ tipo: 'error', texto: 'No se pudo consultar Open Food Facts. Escribe el nombre a mano.' });
      }
    } finally {
      setConsultando(false);
    }
  }

  // The front photo of the product becomes the product photo, unless the user already chose one.
  // A failure (offline, CORS, timeout) is silent: the photo is optional.
  async function downloadFrontPhoto(product) {
    const url = frontImageUrl(product);
    if (!url) return;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) return;
      setCampos((c) => (c.foto ? c : { ...c, foto: blob }));
    } catch {
      // Without the photo the lot is saved the same.
    }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const name = fields.nombre.trim();
    if (!name) return setError('Escribe el nombre del producto');
    if (!fields.categoria) return setError('Elige una categoría');
    if (!fields.ubicacion) return setError('Elige una ubicación');
    const expiryIso = parseTypedDate(fields.caducidad);
    if (!expiryIso) return setError('Indica la caducidad como DD/MM/AAAA, por ejemplo 01/03/2027');
    const quantity = Number(fields.cantidad);
    if (!Number.isInteger(quantity) || quantity < 1) return setError('La cantidad debe ser un número entero de 1 o más');

    setGuardando(true);
    try {
      const existing = productoInicial
        ?? findProductByCode(data.productos, fields.codigo)
        ?? findProductByName(data.productos, name);
      // The photo is saved first: it belongs to the product, new or existing.
      let photoId = '';
      let photoNotice = '';
      if (fields.foto) {
        try {
          photoId = await savePhoto(db, await compressPhoto(fields.foto));
        } catch (e) {
          photoNotice = ` La foto no se guardó: ${e.message}`;
        }
      }
      let product = existing;
      if (!product) {
        product = await createProduct(db, device, {
          nombre: name,
          categoria: fields.categoria,
          codigo_barras: fields.codigo,
          stock_minimo: 0,
          foto_id: photoId,
          // If Open Food Facts brought energy, the calories are stored with the product.
          ...nutritionDataFromOFF(ofProducto ?? {}),
        });
      } else if (photoId) {
        product = await editProduct(db, device, product.id, { foto_id: photoId });
      }
      const r = await addLot(db, device, {
        producto_id: product.id,
        cantidad: quantity,
        caducidad: expiryIso,
        ubicacion: fields.ubicacion,
      });
      if (r.fusionado) {
        // No new lot is created: it is added to the existing one, and it says how much there is now.
        notifyUser(`Ya había un lote de ${product.nombre} con esa caducidad (${r.anterior} ud.). Sumadas ${r.sumadas}: ahora hay ${r.lote.cantidad}.${photoNotice}`, 'info');
      } else {
        notifyUser(`Añadido: ${product.nombre}.${photoNotice}`, photoNotice ? 'error' : 'ok');
      }
      onHecho();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  // Preview warning: if the product already has a lot with that expiry and location, it is added to that one.
  // A product known by its code or coming from Restock keeps its name: the lot form cannot rename it.
  const lockedProduct = productoInicial ?? findProductByCode(data.productos, fields.codigo);
  const currentProduct = lockedProduct
    ?? findProductByName(data.productos, fields.nombre);
  const previousExpiry = parseTypedDate(fields.caducidad);
  const sameLot = currentProduct && previousExpiry
    ? findSameLot(data.lotes, { producto_id: currentProduct.id, caducidad: previousExpiry, ubicacion: fields.ubicacion })
    : null;

  const categories = [...new Set([...config.categorias, fields.categoria].filter(Boolean))];
  const locations = [...new Set([...config.ubicaciones, fields.ubicacion].filter(Boolean))];

  return html`
    <section class="pantalla">
      <h2>Añadir lote</h2>
      <form class="formulario" onSubmit=${save}>
        <div class="fila">
          <${Button} tipo="secundario" onClick=${() => setEscaneando(true)}>Escanear código<//>
          ${fields.codigo && html`<span class="codigo-pequeno">${fields.codigo}</span>`}
        </div>
        ${escaneando && html`<${ScannerModal} onCodigo=${onScanned} onCerrar=${() => setEscaneando(false)} />`}
        ${consultando && html`<p class="secundario">Consultando Open Food Facts…</p>`}
        <${Notice} tipo=${notice?.tipo ?? 'info'}>${notice?.texto}<//>
        ${ofProducto && html`<${Button} tipo="secundario" onClick=${() => setVerOFF(true)}>Ver todos los datos de Open Food Facts<//>`}
        ${verOFF && ofProducto && html`<${OFFData} codigo=${fields.codigo} producto=${ofProducto} onCerrar=${() => setVerOFF(false)} />`}

        <${Field} etiqueta="Producto" ayuda=${lockedProduct ? 'El nombre es del producto: para cambiarlo, edita el producto.' : undefined}>
          <input required list="productos-existentes" value=${fields.nombre} onInput=${change('nombre')} autocomplete="off"
            readOnly=${!!lockedProduct} />
          <datalist id="productos-existentes">
            ${data.productos.filter((p) => !p.borrado).map((p) => html`<option value=${p.nombre}></option>`)}
          </datalist>
        <//>

        <${Field} etiqueta="Categoría">
          <select value=${fields.categoria} onChange=${change('categoria')}>
            ${categories.map((c) => html`<option value=${c} selected=${c === fields.categoria}>${c}</option>`)}
          </select>
        <//>

        <${Field} etiqueta="Ubicación">
          <select value=${fields.ubicacion} onChange=${change('ubicacion')}>
            ${locations.map((u) => html`<option value=${u} selected=${u === fields.ubicacion}>${u}</option>`)}
          </select>
        <//>

        <div class="fila">
          <${Field} etiqueta="Caducidad">
            <input type="text" inputmode="numeric" autocomplete="off" required placeholder="DD/MM/AAAA" maxlength="10"
              value=${fields.caducidad}
              onInput=${(e) => setCampos({ ...fields, caducidad: formatDateInput(e.currentTarget.value) })} />
          <//>
          <${Field} etiqueta="Unidades">
            <input type="number" inputmode="numeric" min="1" step="1" value=${fields.cantidad} onInput=${change('cantidad')} />
          <//>
        </div>


        <${Field} etiqueta="Foto (opcional)">
          <input type="file" accept="image/*" capture="environment"
            onChange=${(e) => setCampos({ ...fields, foto: e.currentTarget.files?.[0] ?? fields.foto })} />
        <//>
        ${previa && html`<img class="previa" src=${previa} alt="Foto del producto" />`}
        ${previa && html`<p class="secundario">Si prefieres otra foto, elígela arriba y sustituirá a esta.</p>`}

        ${sameLot && html`<${Notice} tipo="info">Ya tienes ${sameLot.cantidad} ud. de ${currentProduct.nombre} con esta caducidad y ubicación. Si guardas, se suman a ese lote.<//>`}
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit" disabled=${guardando}>${guardando ? 'Guardando…' : 'Guardar lote'}<//>
          <${Button} tipo="secundario" onClick=${onCancelar}>Cancelar<//>
        </div>
      </form>
    <//>
  `;
}

// Product detail: its lots (the one that expires first first), consume, edit and delete.
export function ProductDetail({ db, dispositivo: device, datos: data, config, producto: product, onCerrar, onAnadirLote, onEditarLote, notificar: notifyUser, refrescar: refresh, solicitarBorrado: requestDelete }) {
  const [cantidades, setCantidades] = useState({});
  const [editando, setEditando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [datosOFF, setDatosOFF] = useState(null);
  const [buscandoOFF, setBuscandoOFF] = useState(false);
  const [productoOFF, setProductoOFF] = useState(null);

  // Open Food Facts data stored in the cache (no network) to compute the calories.
  useEffect(() => {
    if (!product.codigo_barras) { setProductoOFF(null); return; }
    readCacheOFF(db, product.codigo_barras).then(setProductoOFF).catch(() => setProductoOFF(null));
  }, [db, product.codigo_barras]);

  // Product before saving calories: if the OFF cache has them, they are copied to the product (once).
  useEffect(() => {
    if (!productoOFF) return;
    const data = nutritionDataFromOFF(productoOFF);
    if (!('kcal_100g' in data)) return;
    if (product.kcal_100g !== undefined && product.kcal_100g !== '') return;
    editProduct(db, device, product.id, data).then(refresh).catch(() => {});
  }, [productoOFF, product.id]);
  const lots = lotsToConsume(product.id, data.lotes);
  const productUnits = lots.reduce((s, l) => s + l.cantidad, 0);
  // Container calories: first the stored product data; if not, the OFF cache.
  const perContainer = storedKcalPerContainer(product) ?? (productoOFF ? kcalPerContainer(productoOFF) : null);
  const today = todayInMadrid();

  const quantityOf = (id) => Math.max(1, Number(cantidades[id] ?? 1) || 1);

  async function consumeFrom(lot) {
    const n = quantityOf(lot.id);
    try {
      await consume(db, device, lot.id, n);
      notifyUser(`Consumido: ${n} de ${product.nombre}`, 'ok');
      refresh();
    } catch (e) {
      notifyUser(e.message, 'error');
    }
  }

  // Reads the cached data (or the network if not present). No connection and no cache: it warns.
  async function viewOFFData() {
    setBuscandoOFF(true);
    try {
      const r = await queryOFF(db, product.codigo_barras);
      if (r.estado === STATES.ENCONTRADO && r.producto) setDatosOFF(r.producto);
      else if (r.estado === STATES.NO_ENCONTRADO) notifyUser('Open Food Facts no tiene este producto.', 'info');
      else if (r.estado === STATES.SIN_CONEXION) notifyUser('Sin conexión y sin datos guardados de este producto.', 'error');
      else notifyUser('No se pudo consultar Open Food Facts.', 'error');
    } finally {
      setBuscandoOFF(false);
    }
  }

  // The delete is written later, unless "Undo" is pressed in the notice.
  function removeAll() {
    requestDelete({ tipo: 'producto', id: product.id, texto: `${product.nombre} borrado` });
    onCerrar();
  }

  if (editando) {
    return html`<${Modal} titulo="Editar producto" onCerrar=${() => setEditando(false)}>
      <${EditProduct} db=${db} dispositivo=${device} config=${config} producto=${product} fotoId=${photoIdOf(product, data.lotes)}
        notificar=${notifyUser} onHecho=${() => { setEditando(false); refresh(); }} onCancelar=${() => setEditando(false)} />
    <//>`;
  }

  return html`
    <${Modal} titulo=${product.nombre} onCerrar=${onCerrar}>
      <div class="lote-fila">
        <${Thumbnail} db=${db} fotoId=${photoIdOf(product, data.lotes)} />
        <div>
          <p class="secundario">${product.categoria} · mínimo ${product.stock_minimo}</p>
          ${product.observaciones && html`<p class="secundario">${product.observaciones}</p>`}
        </div>
      </div>
      ${perContainer !== null && html`<p class="secundario" data-testid="kcal-producto">Calorías: ${perContainer} kcal por bote · ${Math.round(perContainer * productUnits * 10) / 10} kcal en el stock (${productUnits} ud.)</p>`}
      ${lots.length === 0 && html`<p class="vacio">No quedan unidades de este producto.</p>`}
      <ul class="lista-lotes">
        ${lots.map((lot) => html`
          <li class="lote-fila">
            <div class="lote-datos">
              <strong>${formatDate(lot.caducidad)}</strong>
              <span class="secundario">${describeExpiry(daysBetween(today, lot.caducidad))} · ${lot.ubicacion} · ${lot.cantidad} ud.</span>
            </div>
            <div class="lote-acciones">
              <input type="number" min="1" max=${lot.cantidad} aria-label="Unidades"
                value=${cantidades[lot.id] ?? 1}
                onInput=${(e) => setCantidades({ ...cantidades, [lot.id]: e.currentTarget.value })} />
              <${Button} onClick=${() => consumeFrom(lot)}>Consumir<//>
              <${Button} tipo="secundario" onClick=${() => onEditarLote(lot)}>Editar<//>
            </div>
          </li>
        `)}
      </ul>
      <div class="acciones">
        <${Button} onClick=${() => onAnadirLote(product)}>Añadir lote<//>
        <${Button} tipo="secundario" onClick=${() => setEditando(true)}>Editar producto<//>
        ${product.codigo_barras && html`<${Button} tipo="secundario" disabled=${buscandoOFF} onClick=${viewOFFData}>${buscandoOFF ? 'Buscando…' : 'Datos de Open Food Facts'}<//>`}
      </div>
      ${datosOFF && html`<${OFFData} codigo=${product.codigo_barras} producto=${datosOFF} onCerrar=${() => setDatosOFF(null)} />`}
      <div class="zona-peligro">
        ${!confirmarBorrado
          ? html`<${Button} tipo="peligro" onClick=${() => setConfirmarBorrado(true)}>Borrar producto<//>`
          : html`
            <p>Se borrará el producto y todos sus lotes. ¿Seguro?</p>
            <div class="acciones">
              <${Button} tipo="peligro" onClick=${removeAll}>Sí, borrar<//>
              <${Button} tipo="secundario" onClick=${() => setConfirmarBorrado(false)}>No<//>
            </div>`}
      </div>
    <//>
  `;
}

export function EditProduct({ db, dispositivo: device, config, producto: product, fotoId, notificar: notifyUser, onHecho, onCancelar }) {
  const [name, setNombre] = useState(product.nombre);
  const [category, setCategoria] = useState(product.categoria);
  const [code, setCodigo] = useState(product.codigo_barras ?? '');
  const [minimum, setMinimo] = useState(String(product.stock_minimo));
  const [notes, setObservaciones] = useState(product.observaciones ?? '');
  // Photo chosen now (it replaces the product's photo); without a new one, the photo stays.
  const [photo, setFoto] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [error, setError] = useState('');
  const categories = [...new Set([...config.categorias, category])];

  useEffect(() => {
    if (!photo) { setPrevia(null); return undefined; }
    const url = URL.createObjectURL(photo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function save(event) {
    event.preventDefault();
    try {
      let photoId;
      if (photo) {
        try {
          photoId = await savePhoto(db, await compressPhoto(photo));
        } catch (e) {
          throw new Error(`No se pudo guardar la foto: ${e.message}`);
        }
      }
      await editProduct(db, device, product.id, {
        nombre: name, categoria: category, codigo_barras: code, stock_minimo: Number(minimum),
        observaciones: notes, ...(photoId ? { foto_id: photoId } : {}),
      });
      notifyUser('Producto guardado', 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  return html`
    <section class="pantalla">
      <h2>Editar producto</h2>
      <form class="formulario" onSubmit=${save}>
        <${Field} etiqueta="Nombre"><input required value=${name} onInput=${(e) => setNombre(e.currentTarget.value)} /><//>
        <${Field} etiqueta="Categoría">
          <select value=${category} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            ${categories.map((c) => html`<option value=${c} selected=${c === category}>${c}</option>`)}
          </select>
        <//>
        <${Field} etiqueta="Código de barras"><input inputmode="numeric" value=${code} onInput=${(e) => setCodigo(e.currentTarget.value)} /><//>
        <${Field} etiqueta="Stock mínimo" ayuda="Unidades por debajo de las que avisar en A reponer. 0 = no avisar.">
          <input type="number" min="0" step="1" value=${minimum} onInput=${(e) => setMinimo(e.currentTarget.value)} />
        <//>
        <${Field} etiqueta="Observaciones">
          <input value=${notes} maxlength="200" onInput=${(e) => setObservaciones(e.currentTarget.value)} />
        <//>
        <div class="campo">
          <span class="campo-etiqueta">Foto del producto</span>
          ${!previa && html`<${Thumbnail} db=${db} fotoId=${fotoId} />`}
          ${previa && html`<img class="previa" src=${previa} alt="Foto nueva del producto" />`}
          <input type="file" accept="image/*" capture="environment"
            onChange=${(e) => setFoto(e.currentTarget.files?.[0] ?? null)} />
          <span class="campo-ayuda">Elige una foto para añadirla o cambiarla. Sin foto nueva, se queda la que había.</span>
        </div>
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit">Guardar<//>
          <${Button} tipo="secundario" onClick=${onCancelar}>Cancelar<//>
        </div>
      </form>
    </section>
  `;
}

export function EditLot({ db, dispositivo: device, lote: lot, producto: product, config, notificar: notifyUser, onHecho, onCerrar, solicitarBorrado: requestDelete }) {
  const [expiry, setCaducidad] = useState(formatDate(lot.caducidad));
  const [location, setUbicacion] = useState(lot.ubicacion);
  // Real quantity of the lot: the final number is typed (useful when recounting).
  const [quantity, setCantidad] = useState(String(lot.cantidad));
  const [error, setError] = useState('');
  const [confirmarBorradoLote, setConfirmarBorradoLote] = useState(false);
  const locations = [...new Set([...config.ubicaciones, lot.ubicacion])];

  // A lot only has expiry, location and units. The rest (name, photo, barcode...) belongs to the product.
  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      const expiryIso = parseTypedDate(expiry);
      if (!expiryIso) throw new Error('La caducidad debe ser una fecha válida, por ejemplo 01/03/2027');
      await editLot(db, device, lot.id, {
        caducidad: expiryIso, ubicacion: location, cantidad: Number(quantity),
      });
      notifyUser('Lote guardado', 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  // The delete is confirmed here and written later, unless "Undo" is pressed.
  function remove() {
    setConfirmarBorradoLote(false);
    requestDelete({ tipo: 'lote', id: lot.id, texto: `Lote de ${product.nombre} borrado` });
    onHecho();
  }

  // The arrows add or take one unit, never going below 0.
  function ajustarCantidad(delta) {
    setCantidad(String(Math.max(0, (Number(quantity) || 0) + delta)));
  }

  return html`
    <${Modal} titulo=${`Editar lote de ${product.nombre}`} onCerrar=${onCerrar}>
      <form class="formulario" onSubmit=${save}>
        <${Field} etiqueta="Caducidad" ayuda="Escríbela con el teclado: DD/MM/AAAA.">
          <input type="text" inputmode="numeric" autocomplete="off" required placeholder="DD/MM/AAAA" maxlength="10"
            value=${expiry} onInput=${(e) => setCaducidad(formatDateInput(e.currentTarget.value))} />
        <//>
        <${Field} etiqueta="Ubicación">
          <select value=${location} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            ${locations.map((u) => html`<option value=${u} selected=${u === location}>${u}</option>`)}
          </select>
        <//>
        <${Field} etiqueta="Cantidad" ayuda="Escribe cuántas unidades hay. 0 oculta el lote, no lo borra.">
          <div class="cantidad-control">
            <input type="number" inputmode="numeric" min="0" step="1" required aria-label="Cantidad" value=${quantity} onInput=${(e) => setCantidad(e.currentTarget.value)} />
            <button type="button" aria-label="Aumentar una unidad" onClick=${() => ajustarCantidad(1)}>▲</button>
            <button type="button" aria-label="Reducir una unidad" onClick=${() => ajustarCantidad(-1)}>▼</button>
          </div>
        <//>
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit">Guardar<//>
          ${!confirmarBorradoLote
            ? html`<${Button} tipo="peligro" onClick=${() => setConfirmarBorradoLote(true)}>Borrar lote<//>`
            : html`<span class="confirmacion">¿Seguro? Se quitará este lote.</span>
                <${Button} tipo="peligro" onClick=${remove}>Sí, borrar<//>
                <${Button} tipo="secundario" onClick=${() => setConfirmarBorradoLote(false)}>No<//>`}
        </div>
      </form>
    <//>
  `;
}
