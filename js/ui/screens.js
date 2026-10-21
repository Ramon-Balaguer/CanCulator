import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { SyncBlock } from './sync-block.js';
import { Notice, Button, Field, Empty } from './components.js';
import { ProductImage, Thumbnail } from './thumbnail.js';
import { Barcode } from './barcode-view.js';
import { consume, saveSetting, saveMeta } from '../datos/store.js';
import { downloadText, exportBackup, importBackupFile } from '../datos/backup-io.js';
import { VERSION } from '../version.js';
import { isInstalled, isIOS, installApp, canInstallWithButton, subscribeInstall } from './install.js';
import { validateValue } from '../logica/settings.js';
import { describeExpiry, daysBetween, formatDate, todayInMadrid } from '../logica/dates.js';
import { expiryStatus, filterSummary, shortId, visibleLots, mapById, toRestock, stockSummary } from '../logica/inventory.js';
import { stockStatistics } from '../logica/statistics.js';

// ---------- Expiry ----------
export function ExpiryScreen({ db, dispositivo: device, datos: data, config, notificar: notifyUser, refrescar: refresh, onEditarLote }) {
  const today = todayInMadrid();
  const byId = mapById(data.productos);
  const lots = visibleLots(data.lotes, data.productos);
  if (lots.length === 0) return html`<section class="pantalla"><h2>Caducidad</h2><${Empty}>No hay comida registrada. Usa el botón + para añadir un lote.<//></section>`;

  async function consumeLot(lot, n) {
    try {
      await consume(db, device, lot.id, n);
      notifyUser(`Consumido: ${n} de ${byId.get(lot.producto_id).nombre}`, 'ok');
      refresh();
    } catch (e) {
      notifyUser(e.message, 'error');
    }
  }

  return html`
    <section class="pantalla">
      <h2>Caducidad</h2>
      <ul class="lista">
        ${lots.map((lot) => {
          const product = byId.get(lot.producto_id);
          const status = expiryStatus(lot.caducidad, today, config.dias_caduca_pronto);
          const days = daysBetween(today, lot.caducidad);
          return html`
            <li class=${`tarjeta estado-${status}`}>
              <${Thumbnail} db=${db} fotoId=${lot.foto_id} />
              <div class="tarjeta-cuerpo">
                <strong>${product.nombre}</strong>
                <span class="secundario">${lot.ubicacion} · ${lot.cantidad} ud.</span>
                <span class="etiqueta-estado">${formatDate(lot.caducidad)} · ${describeExpiry(days)}</span>
              </div>
              <div class="tarjeta-acciones">
                <${Button} onClick=${() => consumeLot(lot, 1)}>−1<//>
                <${Button} tipo="secundario" onClick=${() => onEditarLote(lot)}>Editar<//>
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
      <h2>Estadísticas</h2>
    <div class="estadisticas bloque" data-testid="estadisticas">
      ${e.totalUnidades === 0 && html`<p class="vacio">Todavía no hay comida registrada.</p>`}
      <h3>Estadísticas</h3>
      <p>Unidades en total: <strong data-testid="unidades-total">${e.totalUnidades}</strong></p>
      <p>Calorías en total: <strong data-testid="kcal-total">${e.totalKcal} kcal</strong>
        ${e.productosSinKcal > 0 && html`<span class="secundario"> (faltan datos de ${e.productosSinKcal} ${e.productosSinKcal === 1 ? 'producto' : 'productos'})</span>`}
      </p>
      <table class="tabla-estadisticas">
        <thead><tr><th>Categoría</th><th>Unidades</th><th>Kcal</th></tr></thead>
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

export function StockScreen({ datos: data, config, onAbrirProducto }) {
  const [category, setCategoria] = useState('');
  const [location, setUbicacion] = useState('');
  const today = todayInMadrid();
  const summary = filterSummary(stockSummary(data.productos, data.lotes), { categoria: category, ubicacion: location });
  const usedCategories = [...new Set(data.productos.filter((p) => !p.borrado).map((p) => p.categoria))];
  return html`
    <section class="pantalla">
      <h2>Stock</h2>

      <div class="fila">
        <${Field} etiqueta="Categoría">
          <select value=${category} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            <option value="">Todas</option>
            ${[...new Set([...config.categorias, ...usedCategories])].map((c) => html`<option value=${c} selected=${c === category}>${c}</option>`)}
          </select>
        <//>
        <${Field} etiqueta="Ubicación">
          <select value=${location} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            <option value="">Todas</option>
            ${config.ubicaciones.map((u) => html`<option value=${u} selected=${u === location}>${u}</option>`)}
          </select>
        <//>
      </div>
      ${summary.length === 0 && html`<${Empty}>Ningún producto con estos filtros.<//>`}
      <ul class="lista">
        ${summary.map((row) => html`
          <li>
            <button type="button" class="fila-boton" onClick=${() => onAbrirProducto(row.producto)}>
              <span class="fila-titulo">${row.producto.nombre}</span>
              <span class="secundario">${row.producto.categoria}</span>
              <span class="fila-dato">${row.total} ud.${row.proximaCaducidad
                ? html` · ${formatDate(row.proximaCaducidad)} (${describeExpiry(daysBetween(today, row.proximaCaducidad))})`
                : ' · agotado'}</span>
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
    return html`<section class="pantalla"><h2>A reponer</h2><${Empty}>Nada por debajo del mínimo.<//></section>`;
  }
  return html`
    <section class="pantalla">
      <h2>A reponer</h2>
      <ul class="lista">
        ${pending.map((row) => html`
          <li class="tarjeta">
            <div class="tarjeta-cuerpo">
              <strong>${row.producto.nombre}</strong>
              <span class="secundario">Hay ${row.stock} de ${row.producto.stock_minimo} · faltan ${row.falta}</span>
            </div>
            <div class="tarjeta-acciones">
              <${Button} onClick=${() => onComprado(row.producto)}>Comprado<//>
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
  // Imagen de Open Food Facts por código de barras (desde la caché de OFF).
  const offImages = new Map(
    (data.cacheOff ?? []).filter((e) => e.encontrado && e.producto?.image_front_small_url)
      .map((e) => [e.codigo, e.producto.image_front_small_url]),
  );
  return html`
    <section class="pantalla">
      <div class="no-imprimir acciones">
        <h2>Imprimir</h2>
        <${Button} onClick=${() => window.print()}>Imprimir<//>
      </div>
      <p class="solo-imprimir cabecera-impresion">Inventario de casa · ${formatDate(todayInMadrid())}</p>
      <div class="tabla-scroll">
      <table class="tabla-imprimir">
        <thead>
          <tr><th>Foto</th><th>ID</th><th>Producto</th><th>Código</th><th>Ubicación</th><th>Caducidad</th><th>Cant.</th><th>Consumido</th></tr>
        </thead>
        <tbody>
          ${lots.map((lot) => html`
            <tr>
              <td class="celda-foto"><${ProductImage} db=${db} imageUrl=${offImages.get(byId.get(lot.producto_id).codigo_barras)} photoId=${lot.foto_id} /></td>
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
    return html`<div class="bloque"><h3>Instalar</h3><p class="secundario">La app ya está en la pantalla de inicio.</p></div>`;
  }
  if (isIOS()) {
    return html`
      <div class="bloque" data-testid="instalar-ios">
        <h3>Instalar</h3>
        <p>En iPhone se instala desde Safari: toca el botón <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba) y luego <strong>«Añadir a pantalla de inicio»</strong>.</p>
        <p class="secundario">Ábrela después desde ese icono: así funciona sin conexión.</p>
      </div>`;
  }
  return html`
    <div class="bloque" data-testid="instalar-android">
      <h3>Instalar</h3>
      ${boton
        ? html`<div class="acciones"><${Button} onClick=${async () => setMensaje(await installApp() === 'accepted' ? 'Instalada.' : '')}>Instalar en la pantalla de inicio<//></div>`
        : html`<p class="secundario">Para instalarla, abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».</p>`}
      ${mensaje && html`<p class="secundario">${mensaje}</p>`}
    </div>`;
}
function EditableList({ titulo, valores: values, onGuardar, notificar: notifyUser }) {
  const [newItem, setNuevo] = useState('');
  // Removing a category or location asks for confirmation.
  const removeItem = (value) => {
    if (!window.confirm(`¿Quitar «${value}»?`)) return;
    const previous = values;
    onGuardar(values.filter((v) => v !== value))
      .then(() => notifyUser(`Quitada «${value}».`, 'info', { etiqueta: 'Deshacer', onClick: () => onGuardar(previous) }))
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
        ${values.map((v) => html`<li class="chip">${v}<button type="button" aria-label=${`Quitar ${v}`} onClick=${() => removeItem(v)}>✕</button></li>`)}
      </ul>
      <form class="fila" onSubmit=${add}>
        <input value=${newItem} onInput=${(e) => setNuevo(e.currentTarget.value)} aria-label=${`Nueva ${titulo.toLowerCase()}`} />
        <${Button} tipo="secundario" type="submit">Añadir<//>
      </form>
    </div>`;
}

export function SettingsScreen({ db, dispositivo: device, config, notificar: notifyUser, refrescar: refresh, sincronizacion: syncLogic, estadoSync, ultimaSync, pendientes: pending, onToken }) {
  const [importado, setImportado] = useState('');
  const save = async (key, value) => {
    const cleanData = validateValue(key, value);
    await saveSetting(db, key, cleanData);
    refresh();
    return cleanData;
  };

  async function runExport() {
    try {
      downloadText(await exportBackup(db, device));
      notifyUser('Copia exportada', 'ok');
    } catch (e) {
      notifyUser(`No se pudo exportar: ${e.message}`, 'error');
    }
  }

  async function importBackup(event) {
    const uploadedFile = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!uploadedFile) return;
    try {
      const r = await importBackupFile(db, uploadedFile);
      setImportado(`Importado: ${r.productos} productos y ${r.lotes} lotes nuevos o más recientes, ${r.fotos} fotos.`);
      refresh();
    } catch (e) {
      notifyUser(e.message, 'error');
    }
  }


  return html`
    <section class="pantalla">
      <h2>Ajustes</h2>

      <${EditableList} titulo="Categorías" valores=${config.categorias}
        onGuardar=${(list) => save('categorias', list)} notificar=${notifyUser} />
      <${EditableList} titulo="Ubicaciones" valores=${config.ubicaciones}
        onGuardar=${(list) => save('ubicaciones', list)} notificar=${notifyUser} />

      <div class="bloque">
        <h3>Avisos</h3>
        <${Field} etiqueta="Días para «caduca pronto»">
          <input type="number" min="0" max="3650" value=${config.dias_caduca_pronto}
            onChange=${(e) => save('dias_caduca_pronto', e.currentTarget.value).catch((err) => notifyUser(err.message, 'error'))} />
        <//>
        <${Field} etiqueta="Hora del aviso diario">
          <input type="time" value=${config.hora_aviso}
            onChange=${(e) => save('hora_aviso', e.currentTarget.value).catch((err) => notifyUser(err.message, 'error'))} />
        <//>
        <${Field} etiqueta="Emails de avisos" ayuda="Uno por línea o separados por comas.">
          <textarea rows="3" onChange=${(e) => save('emails_avisos', e.currentTarget.value.split(/[\s,]+/)).catch((err) => notifyUser(err.message, 'error'))}>${config.emails_avisos.join('\n')}</textarea>
        <//>
      </div>

      <${SyncBlock} db=${db} deviceId=${device} token=${syncLogic.token} onToken=${onToken} refresh=${refresh} />

      <${InstallApp} />

      <div class="bloque">
        <h3>Versión</h3>
        <p class="secundario">Commit de esta app: <span class="codigo-pequeno" data-testid="version-completa">${VERSION}</span></p>
        <p class="secundario">Compara este texto entre móviles: si coincide, es la misma versión.</p>
      </div>

      <div class="bloque">
        <h3>Diagnóstico</h3>
        <p><a href="camera-test.html">Prueba de cámara y código de barras</a></p>
        <p><a href="peer-test.html">Prueba de sala P2P (dos móviles)</a></p>
      </div>

      <div class="bloque">
        <h3>Copia de seguridad</h3>
        <div class="acciones">
          <${Button} onClick=${runExport}>Exportar JSON<//>
          <label class="boton secundario">
            Importar JSON
            <input type="file" accept="application/json,.json" class="oculto" onChange=${importBackup} />
          </label>
        </div>
        <${Notice} tipo="ok">${importado}<//>
        <p class="secundario">Importar fusiona la copia con lo que ya hay: gana el registro más reciente.</p>
      </div>
    </section>
  `;
}
