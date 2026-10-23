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
import { queryOFF, queryPrecioOFF, STATES, readCacheOFF } from '../datos/off.js';
import { OFFData } from './off-data.js';
import { guessCategory, frontImageUrl } from '../logica/off-category.js';
import { volumenDesdeOFF } from '../logica/openfoodfacts.js';
import { usaVolumen } from '../logica/settings.js';
import { nutritionDataFromOFF, kcalPerContainer, storedKcalPerContainer } from '../logica/nutrition.js';
import { t } from '../logica/idioma.js';

const EMPTY_FIELDS = () => ({
  codigo: '',
  nombre: '',
  categoria: '',
  ubicacion: '',
  caducidad: '',
  cantidad: '1',
  // Optional, only for a new product: the QR link or Open Food Facts bring them.
  // Weight for solid products; volume (ml) for drinks, which Open Food Facts brings.
  peso: '',
  volumen: '',
  precio: '',
  foto: null,
});

// Lot form. If productoInicial arrives (from Restock), it is preselected.
export function LotForm({ db, dispositivo: device, datos: data, config, productoInicial, soloLote, onHecho, onCancelar, notificar: notifyUser }) {
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
  // The expiry date, weight and price come only when the QR carries them; otherwise the fields are kept.
  async function onScanned(code, qr = {}) {
    setEscaneando(false);
    setAviso(null);
    const existing = findProductByCode(data.productos, code);
    setCampos((c) => ({
      ...c,
      codigo: code,
      nombre: existing?.nombre ?? c.nombre,
      categoria: existing?.categoria ?? c.categoria,
      caducidad: qr.caducidad ?? c.caducidad,
      peso: qr.peso ? String(qr.peso) : c.peso,
      precio: qr.precio ? String(qr.precio) : c.precio,
    }));
    if (existing) {
      setAviso({ tipo: 'info', texto: t('anadir.ya_tienes_producto', { nombre: existing.nombre }) });
      return;
    }
    if (!isValidGtin(code)) {
      setAviso({ tipo: 'error', texto: t('anadir.codigo_invalido') });
      return;
    }
    setConsultando(true);
    try {
      // The price comes apart: it does not hold back the product data. A price from the QR label is kept.
      queryPrecioOFF(code).then((precioOFF) => {
        if (precioOFF) setCampos((c) => ({ ...c, precio: c.precio || String(precioOFF) }));
      });
      const r = await queryOFF(db, code);
      if (r.estado === STATES.ENCONTRADO) {
        setOfProducto(r.producto ?? null);
        const guessed = guessCategory(r.producto, config.categorias);
        const ml = volumenDesdeOFF(r.producto);
        setCampos((c) => ({
          ...c,
          nombre: c.nombre.trim() ? c.nombre : r.nombre,
          categoria: guessed || c.categoria,
          volumen: c.volumen || (ml ? String(ml) : ''),
        }));
        const brand = r.marca && r.marca !== r.nombre ? ` (${r.marca})` : '';
        const category = guessed ? t('off.categoria_sugerida', { categoria: guessed }) : '';
        setAviso({ tipo: 'info', texto: t('off.encontrado', { nombre: r.nombre, marca: brand, categoria: category }) });
        downloadFrontPhoto(r.producto);
      } else if (r.estado === STATES.NO_ENCONTRADO) {
        setAviso({ tipo: 'info', texto: t('off.no_encontrado') });
      } else if (r.estado === STATES.SIN_CONEXION) {
        setAviso({ tipo: 'info', texto: t('off.sin_conexion') });
      } else {
        setAviso({ tipo: 'error', texto: t('off.error') });
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
    if (!name) return setError(t('anadir.error_nombre'));
    if (!fields.categoria) return setError(t('anadir.error_categoria'));
    if (!fields.ubicacion) return setError(t('anadir.error_ubicacion'));
    const expiryIso = parseTypedDate(fields.caducidad);
    if (!expiryIso) return setError(t('anadir.error_caducidad'));
    const quantity = Number(fields.cantidad);
    if (!Number.isInteger(quantity) || quantity < 1) return setError(t('anadir.error_cantidad'));

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
          photoNotice = t('anadir.foto_no_guardada', { error: e.message });
        }
      }
      let product = existing;
      if (!product) {
        product = await createProduct(db, device, {
          nombre: name,
          categoria: fields.categoria,
          codigo_barras: fields.codigo,
          stock_minimo: 0,
          // Drinks are measured in ml and solids in grams: only the one that fits the category is stored.
          peso_g: usaVolumen(fields.categoria) ? '' : fields.peso,
          volumen_ml: usaVolumen(fields.categoria) ? fields.volumen : '',
          precio: fields.precio,
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
        notifyUser(t('anadir.fusionado', { nombre: product.nombre, anterior: r.anterior, sumadas: r.sumadas, total: r.lote.cantidad, foto: photoNotice }), 'info');
      } else {
        notifyUser(t('anadir.anadido', { nombre: product.nombre, foto: photoNotice }), photoNotice ? 'error' : 'ok');
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

  // Adding a lot from a product's detail: the product is already known,
  // so only the lot's own data is asked: location, expiry and units.
  const loteDeProducto = !!soloLote;

  return html`
    <section class="pantalla">
      <h2>${t('anadir.titulo')}</h2>
      <form class="formulario" onSubmit=${save}>
        ${!loteDeProducto && html`
          <div class="fila">
            <${Button} tipo="secundario" onClick=${() => setEscaneando(true)}>${t('btn.escanear_codigo')}<//>
            ${fields.codigo && html`<span class="codigo-pequeno">${fields.codigo}</span>`}
          </div>
          ${escaneando && html`<${ScannerModal} onCodigo=${onScanned} onCerrar=${() => setEscaneando(false)} />`}
          ${consultando && html`<p class="secundario">${t('anadir.consultando')}</p>`}
          <${Notice} tipo=${notice?.tipo ?? 'info'}>${notice?.texto}<//>
          ${ofProducto && html`<${Button} tipo="secundario" onClick=${() => setVerOFF(true)}>${t('btn.ver_datos_off')}<//>`}
          ${verOFF && ofProducto && html`<${OFFData} codigo=${fields.codigo} producto=${ofProducto} onCerrar=${() => setVerOFF(false)} />`}

          <${Field} etiqueta=${t('anadir.producto')} ayuda=${lockedProduct ? t('anadir.producto_bloqueado') : undefined}>
            <input required list="productos-existentes" value=${fields.nombre} onInput=${change('nombre')} autocomplete="off"
              readOnly=${!!lockedProduct} />
            <datalist id="productos-existentes">
              ${data.productos.filter((p) => !p.borrado).map((p) => html`<option value=${p.nombre}></option>`)}
            </datalist>
          <//>

          <${Field} etiqueta=${t('anadir.categoria')}>
            <select value=${fields.categoria} onChange=${change('categoria')}>
              ${categories.map((c) => html`<option value=${c} selected=${c === fields.categoria}>${c}</option>`)}
            </select>
          <//>

          ${!currentProduct && html`
            <div class="fila">
              <${Field} etiqueta=${t(usaVolumen(fields.categoria) ? 'producto.volumen' : 'producto.peso')}>
                <input type="number" inputmode="decimal" min="0" step="any" value=${usaVolumen(fields.categoria) ? fields.volumen : fields.peso}
                  onInput=${change(usaVolumen(fields.categoria) ? 'volumen' : 'peso')} />
              <//>
              <${Field} etiqueta=${t('producto.precio')}>
                <input type="number" inputmode="decimal" min="0" step="0.01" value=${fields.precio} onInput=${change('precio')} />
              <//>
            </div>
          `}
        `}

        <${Field} etiqueta=${t('anadir.ubicacion')}>
          <select value=${fields.ubicacion} onChange=${change('ubicacion')}>
            ${locations.map((u) => html`<option value=${u} selected=${u === fields.ubicacion}>${u}</option>`)}
          </select>
        <//>

        <div class="fila">
          <${Field} etiqueta=${t('anadir.caducidad')}>
            <input type="text" inputmode="numeric" autocomplete="off" required placeholder=${t('fecha.formato')} maxlength="10"
              value=${fields.caducidad}
              onInput=${(e) => setCampos({ ...fields, caducidad: formatDateInput(e.currentTarget.value) })} />
          <//>
          <${Field} etiqueta=${t('anadir.unidades')}>
            <input type="number" inputmode="numeric" min="1" step="1" value=${fields.cantidad} onInput=${change('cantidad')} />
          <//>
        </div>


        ${!loteDeProducto && html`
          <${Field} etiqueta=${t('anadir.foto')}>
            <input type="file" accept="image/*" capture="environment"
              onChange=${(e) => setCampos({ ...fields, foto: e.currentTarget.files?.[0] ?? fields.foto })} />
          <//>
          ${previa && html`<img class="previa" src=${previa} alt=${t('anadir.foto_alt')} />`}
          ${previa && html`<p class="secundario">${t('anadir.foto_cambiar')}</p>`}
        `}

        ${sameLot && html`<${Notice} tipo="info">${t('anadir.ya_tienes_lote', { cantidad: sameLot.cantidad, nombre: currentProduct.nombre })}<//>`}
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit" disabled=${guardando}>${guardando ? t('btn.guardando') : t('btn.guardar_lote')}<//>
          <${Button} tipo="secundario" onClick=${onCancelar}>${t('btn.cancelar')}<//>
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
      notifyUser(t('caducidad.consumido', { n, nombre: product.nombre }), 'ok');
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
      else if (r.estado === STATES.NO_ENCONTRADO) notifyUser(t('off.no_existe'), 'info');
      else if (r.estado === STATES.SIN_CONEXION) notifyUser(t('off.sin_datos'), 'error');
      else notifyUser(t('off.error_consulta'), 'error');
    } finally {
      setBuscandoOFF(false);
    }
  }

  // The delete is written later, unless "Undo" is pressed in the notice.
  function removeAll() {
    requestDelete({ tipo: 'producto', id: product.id, texto: t('producto.borrado', { nombre: product.nombre }) });
    onCerrar();
  }

  if (editando) {
    return html`<${Modal} titulo=${t('producto.editar_titulo')} onCerrar=${() => setEditando(false)}>
      <${EditProduct} db=${db} dispositivo=${device} config=${config} producto=${product} fotoId=${photoIdOf(product, data.lotes)}
        notificar=${notifyUser} onHecho=${() => { setEditando(false); refresh(); }} onCancelar=${() => setEditando(false)} />
    <//>`;
  }

  return html`
    <${Modal} titulo=${product.nombre} onCerrar=${onCerrar}>
      <div class="lote-fila">
        <${Thumbnail} db=${db} fotoId=${photoIdOf(product, data.lotes)} />
        <div>
          <p class="secundario">${t('producto.resumen', { categoria: product.categoria, minimo: product.stock_minimo })}</p>
          ${product.observaciones && html`<p class="secundario">${product.observaciones}</p>`}
        </div>
      </div>
      ${perContainer !== null && html`<p class="secundario" data-testid="kcal-producto">${t('producto.kcal', { kcal: perContainer, total: Math.round(perContainer * productUnits * 10) / 10, ud: productUnits })}</p>`}
      ${lots.length === 0 && html`<p class="vacio">${t('producto.sin_unidades')}</p>`}
      <ul class="lista-lotes">
        ${lots.map((lot) => html`
          <li class="lote-fila">
            <div class="lote-datos">
              <strong>${formatDate(lot.caducidad)}</strong>
              <span class="secundario">${describeExpiry(daysBetween(today, lot.caducidad))} · ${lot.ubicacion} · ${lot.cantidad} ${t('unidades.abrev')}</span>
            </div>
            <div class="lote-acciones">
              <input type="number" min="1" max=${lot.cantidad} aria-label=${t('anadir.unidades')}
                value=${cantidades[lot.id] ?? 1}
                onInput=${(e) => setCantidades({ ...cantidades, [lot.id]: e.currentTarget.value })} />
              <${Button} onClick=${() => consumeFrom(lot)}>${t('btn.consumir')}<//>
              <${Button} tipo="secundario" onClick=${() => onEditarLote(lot)}>${t('btn.editar')}<//>
            </div>
          </li>
        `)}
      </ul>
      <div class="acciones">
        <${Button} onClick=${() => onAnadirLote(product)}>${t('btn.anadir_lote')}<//>
        <${Button} tipo="secundario" onClick=${() => setEditando(true)}>${t('btn.editar_producto')}<//>
        ${product.codigo_barras && html`<${Button} tipo="secundario" disabled=${buscandoOFF} onClick=${viewOFFData}>${buscandoOFF ? t('btn.buscando') : t('btn.datos_off')}<//>`}
      </div>
      ${datosOFF && html`<${OFFData} codigo=${product.codigo_barras} producto=${datosOFF} onCerrar=${() => setDatosOFF(null)} />`}
      <div class="zona-peligro">
        ${!confirmarBorrado
          ? html`<${Button} tipo="peligro" onClick=${() => setConfirmarBorrado(true)}>${t('btn.borrar_producto')}<//>`
          : html`
            <p>${t('producto.borrar_aviso')}</p>
            <div class="acciones">
              <${Button} tipo="peligro" onClick=${removeAll}>${t('btn.si_borrar')}<//>
              <${Button} tipo="secundario" onClick=${() => setConfirmarBorrado(false)}>${t('btn.no')}<//>
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
  const [weight, setPeso] = useState(String(product.peso_g ?? ''));
  const [volume, setVolumen] = useState(String(product.volumen_ml ?? ''));
  const [price, setPrecio] = useState(String(product.precio ?? ''));
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
          throw new Error(t('producto.error_foto', { error: e.message }));
        }
      }
      await editProduct(db, device, product.id, {
        nombre: name, categoria: category, codigo_barras: code, stock_minimo: Number(minimum),
        peso_g: usaVolumen(category) ? '' : weight, volumen_ml: usaVolumen(category) ? volume : '',
        precio: price, observaciones: notes, ...(photoId ? { foto_id: photoId } : {}),
      });
      notifyUser(t('producto.guardado'), 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  return html`
    <section class="pantalla">
      <h2>${t('producto.editar_titulo')}</h2>
      <form class="formulario" onSubmit=${save}>
        <${Field} etiqueta=${t('producto.nombre')}><input required value=${name} onInput=${(e) => setNombre(e.currentTarget.value)} /><//>
        <${Field} etiqueta=${t('anadir.categoria')}>
          <select value=${category} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            ${categories.map((c) => html`<option value=${c} selected=${c === category}>${c}</option>`)}
          </select>
        <//>
        <${Field} etiqueta=${t('producto.codigo_barras')}><input inputmode="numeric" value=${code} onInput=${(e) => setCodigo(e.currentTarget.value)} /><//>
        <${Field} etiqueta=${t('producto.stock_minimo')} ayuda=${t('producto.stock_minimo_ayuda')}>
          <input type="number" min="0" step="1" value=${minimum} onInput=${(e) => setMinimo(e.currentTarget.value)} />
        <//>
        <div class="fila">
          ${usaVolumen(category)
            ? html`<${Field} etiqueta=${t('producto.volumen')}>
                <input type="number" inputmode="decimal" min="0" step="any" value=${volume} onInput=${(e) => setVolumen(e.currentTarget.value)} />
              <//>`
            : html`<${Field} etiqueta=${t('producto.peso')}>
                <input type="number" inputmode="decimal" min="0" step="any" value=${weight} onInput=${(e) => setPeso(e.currentTarget.value)} />
              <//>`}
          <${Field} etiqueta=${t('producto.precio')}>
            <input type="number" inputmode="decimal" min="0" step="0.01" value=${price} onInput=${(e) => setPrecio(e.currentTarget.value)} />
          <//>
        </div>
        <${Field} etiqueta=${t('producto.observaciones')}>
          <input value=${notes} maxlength="200" onInput=${(e) => setObservaciones(e.currentTarget.value)} />
        <//>
        <div class="campo">
          <span class="campo-etiqueta">${t('producto.foto')}</span>
          ${!previa && html`<${Thumbnail} db=${db} fotoId=${fotoId} />`}
          ${previa && html`<img class="previa" src=${previa} alt=${t('producto.foto_nueva_alt')} />`}
          <input type="file" accept="image/*" capture="environment"
            onChange=${(e) => setFoto(e.currentTarget.files?.[0] ?? null)} />
          <span class="campo-ayuda">${t('producto.foto_ayuda')}</span>
        </div>
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit">${t('btn.guardar')}<//>
          <${Button} tipo="secundario" onClick=${onCancelar}>${t('btn.cancelar')}<//>
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
      if (!expiryIso) throw new Error(t('lote.error_caducidad'));
      await editLot(db, device, lot.id, {
        caducidad: expiryIso, ubicacion: location, cantidad: Number(quantity),
      });
      notifyUser(t('lote.guardado'), 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  // The delete is confirmed here and written later, unless "Undo" is pressed.
  function remove() {
    setConfirmarBorradoLote(false);
    requestDelete({ tipo: 'lote', id: lot.id, texto: t('lote.borrado', { nombre: product.nombre }) });
    onHecho();
  }

  // The arrows add or take one unit, never going below 0.
  function ajustarCantidad(delta) {
    setCantidad(String(Math.max(0, (Number(quantity) || 0) + delta)));
  }

  return html`
    <${Modal} titulo=${t('lote.editar_titulo', { nombre: product.nombre })} onCerrar=${onCerrar}>
      <form class="formulario" onSubmit=${save}>
        <${Field} etiqueta=${t('anadir.caducidad')} ayuda=${t('lote.caducidad_ayuda')}>
          <input type="text" inputmode="numeric" autocomplete="off" required placeholder=${t('fecha.formato')} maxlength="10"
            value=${expiry} onInput=${(e) => setCaducidad(formatDateInput(e.currentTarget.value))} />
        <//>
        <${Field} etiqueta=${t('anadir.ubicacion')}>
          <select value=${location} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            ${locations.map((u) => html`<option value=${u} selected=${u === location}>${u}</option>`)}
          </select>
        <//>
        <${Field} etiqueta=${t('lote.cantidad')} ayuda=${t('lote.cantidad_ayuda')}>
          <div class="cantidad-control">
            <input type="number" inputmode="numeric" min="0" step="1" required aria-label=${t('lote.cantidad')} value=${quantity} onInput=${(e) => setCantidad(e.currentTarget.value)} />
            <button type="button" aria-label=${t('btn.aumentar')} onClick=${() => ajustarCantidad(1)}>▲</button>
            <button type="button" aria-label=${t('btn.reducir')} onClick=${() => ajustarCantidad(-1)}>▼</button>
          </div>
        <//>
        <${Notice} tipo="error">${error}<//>
        <div class="acciones">
          <${Button} type="submit">${t('btn.guardar')}<//>
          ${!confirmarBorradoLote
            ? html`<${Button} tipo="peligro" onClick=${() => setConfirmarBorradoLote(true)}>${t('btn.borrar_lote')}<//>`
            : html`<span class="confirmacion">${t('lote.confirmar')}</span>
                <${Button} tipo="peligro" onClick=${remove}>${t('btn.si_borrar')}<//>
                <${Button} tipo="secundario" onClick=${() => setConfirmarBorradoLote(false)}>${t('btn.no')}<//>`}
        </div>
      </form>
    <//>
  `;
}
