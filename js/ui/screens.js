import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { SyncBlock } from './sync-block.js';
import { Notice, Button, Field, Empty } from './components.js';
import { ProductImage } from './thumbnail.js';
import { Barcode } from './barcode-view.js';
import { consume, saveSetting, saveMeta } from '../datos/store.js';
import { downloadText, exportBackup, importBackupFile } from '../datos/backup-io.js';
import { VERSION } from '../version.js';
import { isInstalled, isIOS, installApp, canInstallWithButton, subscribeInstall } from './install.js';
import { validateValue } from '../logica/settings.js';
import { describeExpiry, daysBetween, formatDate, todayInMadrid } from '../logica/dates.js';
import { expiryStatus, filterSummary, shortId, visibleLots, mapById, toRestock, stockSummary, photoIdOf } from '../logica/inventory.js';
import { stockStatistics } from '../logica/statistics.js';
import { t, idiomaActual, cambiarIdioma, IDIOMAS, NOMBRES_IDIOMA } from '../logica/idioma.js';

// ---------- Expiry ----------
export function ExpiryScreen({ db, dispositivo: device, datos: data, config, notificar: notifyUser, refrescar: refresh, onEditarLote }) {
  const today = todayInMadrid();
  const byId = mapById(data.productos);
  const lots = visibleLots(data.lotes, data.productos);
  if (lots.length === 0) return html`<section class="pantalla"><h2>${t('caducidad.titulo')}</h2><${Empty}>${t('caducidad.vacio')}<//></section>`;
  const offPhotos = offPhotosByBarcode(data.cacheOff ?? []);

  async function consumeLot(lot, n) {
    try {
      await consume(db, device, lot.id, n);
      notifyUser(t('caducidad.consumido', { n, nombre: byId.get(lot.producto_id).nombre }), 'ok');
      refresh();
    } catch (e) {
      notifyUser(e.message, 'error');
    }
  }

  return html`
    <section class="pantalla">
      <h2>${t('caducidad.titulo')}</h2>
      <ul class="lista">
        ${lots.map((lot) => {
          const product = byId.get(lot.producto_id);
          const status = expiryStatus(lot.caducidad, today, config.dias_caduca_pronto);
          const days = daysBetween(today, lot.caducidad);
          return html`
            <li class=${`tarjeta estado-${status}`}>
              <${ProductImage} db=${db} offFotoId=${offPhotos.get(product.codigo_barras)} photoId=${photoIdOf(product, data.lotes)} />
              <div class="tarjeta-cuerpo">
                <strong>${product.nombre}</strong>
                <span class="secundario">${lot.ubicacion} · ${lot.cantidad} ${t('unidades.abrev')}</span>
                <span class="etiqueta-estado">${formatDate(lot.caducidad)} · ${describeExpiry(days)}</span>
              </div>
              <div class="tarjeta-acciones">
                <${Button} className="consumir" onClick=${() => consumeLot(lot, 1)}>−1<//>
                <${Button} tipo="secundario" onClick=${() => onEditarLote(lot)}>${t('btn.editar')}<//>
              </div>
            </li>`;
        })}
      </ul>
    </section>
  `;
}

// ---------- Stock ----------
// Statistics screen: new ones are added here. They count the whole stock, without filters.
export function StatisticsScreen({ datos: data }) {
  const e = stockStatistics(data.productos, data.lotes, data.cacheOff ?? []);
  return html`
    <section class="pantalla">
      <h2>${t('estadisticas.titulo')}</h2>
    <div class="estadisticas bloque" data-testid="estadisticas">
      ${e.totalUnidades === 0 && html`<p class="vacio">${t('estadisticas.vacio')}</p>`}
      <h3>${t('estadisticas.titulo')}</h3>
      <p>${t('estadisticas.unidades_total')} <strong data-testid="unidades-total">${e.totalUnidades}</strong></p>
      <p>${t('estadisticas.kcal_total')} <strong data-testid="kcal-total">${e.totalKcal} kcal</strong>
        ${e.productosSinKcal > 0 && html`<span class="secundario"> ${e.productosSinKcal === 1
          ? t('estadisticas.faltan_uno')
          : t('estadisticas.faltan_varios', { n: e.productosSinKcal })}</span>`}
      </p>
      <table class="tabla-estadisticas">
        <thead><tr><th>${t('estadisticas.categoria')}</th><th>${t('estadisticas.unidades')}</th><th>Kcal</th></tr></thead>
        <tbody>
          ${e.porCategoria.map((c) => html`
            <tr>
              <td>${c.categoria}</td>
              <td>${c.unidades}</td>
              <td>${c.productosSinKcal > 0 && c.kcal === 0 ? '—' : `${c.kcal}`}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>
    </section>`;
}

// Id of the Open Food Facts photo kept in the local database, by barcode (from the OFF cache).
function offPhotosByBarcode(cacheOff) {
  return new Map(
    cacheOff.filter((e) => e.encontrado && e.foto_off)
      .map((e) => [e.codigo, e.foto_off]),
  );
}

export function StockScreen({ db, datos: data, config, onAbrirProducto }) {
  const [category, setCategoria] = useState('');
  const [location, setUbicacion] = useState('');
  const today = todayInMadrid();
  const summary = filterSummary(stockSummary(data.productos, data.lotes), { categoria: category, ubicacion: location });
  const usedCategories = [...new Set(data.productos.filter((p) => !p.borrado).map((p) => p.categoria))];
  const offPhotos = offPhotosByBarcode(data.cacheOff ?? []);
  return html`
    <section class="pantalla">
      <h2>${t('stock.titulo')}</h2>

      <div class="fila">
        <${Field} etiqueta=${t('stock.categoria')}>
          <select value=${category} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            <option value="">${t('stock.todas')}</option>
            ${[...new Set([...config.categorias, ...usedCategories])].map((c) => html`<option value=${c} selected=${c === category}>${c}</option>`)}
          </select>
        <//>
        <${Field} etiqueta=${t('stock.ubicacion')}>
          <select value=${location} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            <option value="">${t('stock.todas')}</option>
            ${config.ubicaciones.map((u) => html`<option value=${u} selected=${u === location}>${u}</option>`)}
          </select>
        <//>
      </div>
      ${summary.length === 0 && html`<${Empty}>${t('stock.vacio')}<//>`}
      <ul class="lista">
        ${summary.map((row) => html`
          <li>
            <button type="button" class="fila-boton" onClick=${() => onAbrirProducto(row.producto)}>
              <${ProductImage} db=${db} offFotoId=${offPhotos.get(row.producto.codigo_barras)} photoId=${row.fotoId} />
              <span class="fila-texto">
                <span class="fila-titulo">${row.producto.nombre}</span>
                <span class="secundario">${row.producto.categoria}</span>
                <span class="fila-dato">${row.total} ${t('unidades.abrev')}${row.proximaCaducidad
                  ? html` · ${formatDate(row.proximaCaducidad)} (${describeExpiry(daysBetween(today, row.proximaCaducidad))})`
                  : ` · ${t('stock.agotado')}`}</span>
              </span>
            </button>
          </li>`)}
      </ul>
    </section>
  `;
}

// ---------- Restock ----------
export function RestockScreen({ datos: data, onComprado }) {
  const pending = toRestock(data.productos, data.lotes);
  if (pending.length === 0) {
    return html`<section class="pantalla">
      <h2>${t('reponer.titulo')}</h2>
      <${Empty}>${t('reponer.vacio')}<//>
      <${Empty}>${t('reponer.ayuda')}<//>
    </section>`;
  }
  return html`
    <section class="pantalla">
      <h2>${t('reponer.titulo')}</h2>
      <ul class="lista">
        ${pending.map((row) => html`
          <li class="tarjeta">
            <div class="tarjeta-cuerpo">
              <strong>${row.producto.nombre}</strong>
              <span class="secundario">${t('reponer.hay', { stock: row.stock, minimo: row.producto.stock_minimo, falta: row.falta })}</span>
            </div>
            <div class="tarjeta-acciones">
              <${Button} onClick=${() => onComprado(row.producto)}>${t('btn.comprado')}<//>
            </div>
          </li>`)}
      </ul>
    </section>
  `;
}

// ---------- Print ----------
export function PrintScreen({ db, datos: data }) {
  const byId = mapById(data.productos);
  const lots = visibleLots(data.lotes, data.productos);
  const offPhotos = offPhotosByBarcode(data.cacheOff ?? []);
  return html`
    <section class="pantalla">
      <div class="no-imprimir acciones">
        <h2>${t('imprimir.titulo')}</h2>
        <${Button} onClick=${() => window.print()}>${t('btn.imprimir')}<//>
      </div>
      <p class="solo-imprimir cabecera-impresion">${t('imprimir.cabecera', { fecha: formatDate(todayInMadrid()) })}</p>
      <div class="tabla-scroll">
      <table class="tabla-imprimir">
        <thead>
          <tr><th>${t('imprimir.foto')}</th><th>ID</th><th>${t('imprimir.producto')}</th><th>${t('imprimir.codigo')}</th><th>${t('imprimir.ubicacion')}</th><th>${t('imprimir.caducidad')}</th><th>${t('imprimir.cantidad')}</th><th>${t('imprimir.consumido')}</th></tr>
        </thead>
        <tbody>
          ${lots.map((lot) => html`
            <tr>
              <td class="celda-foto"><${ProductImage} db=${db} offFotoId=${offPhotos.get(byId.get(lot.producto_id).codigo_barras)} photoId=${photoIdOf(byId.get(lot.producto_id), data.lotes)} /></td>
              <td>${shortId(lot.id)}</td>
              <td>${byId.get(lot.producto_id).nombre}</td>
              <td class="celda-codigo"><${Barcode} codigo=${byId.get(lot.producto_id).codigo_barras} /></td>
              <td>${lot.ubicacion}</td>
              <td>${formatDate(lot.caducidad)}</td>
              <td>${lot.cantidad}</td>
              <td class="celda-vacia"></td>
            </tr>`)}
        </tbody>
      </table>
      </div>
    </section>
  `;
}

// ---------- Settings ----------
// Install on the home screen: button on Android, instructions on iPhone.
function InstallApp() {
  const [boton, setBoton] = useState(canInstallWithButton());
  const [mensaje, setMensaje] = useState('');
  useEffect(() => subscribeInstall(() => setBoton(canInstallWithButton())), []);

  if (isInstalled()) {
    return html`<div class="bloque"><h3>${t('instalar.titulo')}</h3><p class="secundario">${t('instalar.ya_instalada')}</p></div>`;
  }
  if (isIOS()) {
    return html`
      <div class="bloque" data-testid="instalar-ios">
        <h3>${t('instalar.titulo')}</h3>
        <p>${t('instalar.ios_1')} <strong>${t('instalar.ios_compartir')}</strong> ${t('instalar.ios_2')} <strong>${t('instalar.ios_añadir')}</strong>.</p>
        <p class="secundario">${t('instalar.ios_abrir')}</p>
      </div>`;
  }
  return html`
    <div class="bloque" data-testid="instalar-android">
      <h3>${t('instalar.titulo')}</h3>
      ${boton
        ? html`<div class="acciones"><${Button} onClick=${async () => setMensaje(await installApp() === 'accepted' ? t('instalar.instalada') : '')}>${t('instalar.boton')}<//></div>`
        : html`<p class="secundario">${t('instalar.menu')}</p>`}
      ${mensaje && html`<p class="secundario">${mensaje}</p>`}
    </div>`;
}

function EditableList({ titulo, etiquetaNueva, valores: values, onGuardar, notificar: notifyUser }) {
  const [newItem, setNuevo] = useState('');
  // Removing a category or location asks for confirmation.
  const removeItem = (value) => {
    if (!window.confirm(t('ajustes.confirmar_quitar', { valor: value }))) return;
    const previous = values;
    onGuardar(values.filter((v) => v !== value))
      .then(() => notifyUser(t('ajustes.quitada', { valor: value }), 'info', { etiqueta: t('btn.deshacer'), onClick: () => onGuardar(previous) }))
      .catch((e) => notifyUser(e.message, 'error'));
  };
  const add = (event) => {
    event.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    onGuardar([...values, text])
      .then(() => setNuevo(''))
      .catch((e) => notifyUser(e.message, 'error'));
  };
  return html`
    <div class="bloque">
      <h3>${titulo}</h3>
      <ul class="chips">
        ${values.map((v) => html`<li class="chip">${v}<button type="button" aria-label=${t('btn.quitar', { valor: v })} onClick=${() => removeItem(v)}>✕</button></li>`)}
      </ul>
      <form class="fila" onSubmit=${add}>
        <input value=${newItem} onInput=${(e) => setNuevo(e.currentTarget.value)} aria-label=${etiquetaNueva} />
        <${Button} tipo="secundario" type="submit">${t('btn.anadir')}<//>
      </form>
    </div>`;
}

export function SettingsScreen({ db, dispositivo: device, config, notificar: notifyUser, refrescar: refresh, token, onToken }) {
  const [importado, setImportado] = useState('');
  const save = async (key, value) => {
    const cleanData = validateValue(key, value);
    await saveSetting(db, device, key, cleanData);
    refresh();
    return cleanData;
  };

  async function runExport() {
    try {
      downloadText(await exportBackup(db, device));
      notifyUser(t('ajustes.exportada'), 'ok');
    } catch (e) {
      notifyUser(t('ajustes.error_exportar', { error: e.message }), 'error');
    }
  }

  async function importBackup(event) {
    const uploadedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!uploadedFile) return;
    try {
      const r = await importBackupFile(db, uploadedFile);
      setImportado(t('ajustes.importado', { productos: r.productos, lotes: r.lotes, fotos: r.fotos }));
      refresh();
    } catch (e) {
      notifyUser(e.message, 'error');
    }
  }

  return html`
    <section class="pantalla">
      <h2>${t('ajustes.titulo')}</h2>

      <div class="bloque">
        <h3>${t('ajustes.idioma')}</h3>
        <${Field} etiqueta=${t('ajustes.idioma')}>
          <select value=${idiomaActual()} onChange=${(e) => cambiarIdioma(e.currentTarget.value)}>
            ${IDIOMAS.map((id) => html`<option value=${id} selected=${id === idiomaActual()}>${NOMBRES_IDIOMA[id]}</option>`)}
          </select>
        <//>
      </div>

      <${EditableList} titulo=${t('ajustes.categorias')} etiquetaNueva=${t('ajustes.nueva_categoria')} valores=${config.categorias}
        onGuardar=${(list) => save('categorias', list)} notificar=${notifyUser} />
      <${EditableList} titulo=${t('ajustes.ubicaciones')} etiquetaNueva=${t('ajustes.nueva_ubicacion')} valores=${config.ubicaciones}
        onGuardar=${(list) => save('ubicaciones', list)} notificar=${notifyUser} />

      <div class="bloque">
        <h3>${t('ajustes.avisos')}</h3>
        <${Field} etiqueta=${t('ajustes.dias_caduca_pronto')}>
          <input type="number" min="0" max="3650" value=${config.dias_caduca_pronto}
            onChange=${(e) => save('dias_caduca_pronto', e.currentTarget.value).catch((err) => notifyUser(err.message, 'error'))} />
        <//>
        <${Field} etiqueta=${t('ajustes.hora_aviso')}>
          <input type="time" value=${config.hora_aviso}
            onChange=${(e) => save('hora_aviso', e.currentTarget.value).catch((err) => notifyUser(err.message, 'error'))} />
        <//>
        <${Field} etiqueta=${t('ajustes.emails')} ayuda=${t('ajustes.emails_ayuda')}>
          <textarea rows="3" onChange=${(e) => save('emails_avisos', e.currentTarget.value.split(/[\s,]+/)).catch((err) => notifyUser(err.message, 'error'))}>${config.emails_avisos.join('\n')}</textarea>
        <//>
      </div>

      <${SyncBlock} db=${db} deviceId=${device} token=${token} onToken=${onToken} refresh=${refresh} />

      <${InstallApp} />

      <div class="bloque">
        <h3>${t('ajustes.version')}</h3>
        <p class="secundario">${t('ajustes.commit')} <span class="codigo-pequeno" data-testid="version-completa">${VERSION}</span></p>
        <p class="secundario">${t('ajustes.comparar_version')}</p>
      </div>

      <div class="bloque">
        <h3>${t('ajustes.diagnostico')}</h3>
        <p><a href="camera-test.html">${t('ajustes.prueba_camara')}</a></p>
        <p><a href="peer-test.html">${t('ajustes.prueba_sala')}</a></p>
      </div>

      <div class="bloque">
        <h3>${t('ajustes.copia')}</h3>
        <div class="acciones">
          <${Button} onClick=${runExport}>${t('ajustes.exportar')}<//>
          <label class="boton secundario">
            ${t('ajustes.importar')}
            <input type="file" accept="application/json,.json" class="oculto" onChange=${importBackup} />
          </label>
        </div>
        <${Notice} tipo="ok">${importado}<//>
        <p class="secundario">${t('ajustes.copia_ayuda')}</p>
      </div>
    </section>
  `;
}
