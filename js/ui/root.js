import { html } from 'htm/preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Notice } from './components.js';
import { LotForm, ProductDetail, EditLot } from './forms.js';
import { SettingsScreen, ExpiryScreen, StatisticsScreen, PrintScreen, RestockScreen, StockScreen } from './screens.js';
import { removeLot, removeProduct, loadAll, deviceId, readMeta } from '../datos/store.js';
import { syncAll, Offline } from '../datos/sync.js';
import { enviarCambiosPendientes } from '../datos/peer-link.js';
import { restaurarSala } from './sync-block.js';
import { effectiveSettings } from '../logica/settings.js';

const TABS = [
  { id: 'caducidad', texto: 'Caducidad' },
  { id: 'stock', texto: 'Stock' },
  { id: 'reponer', texto: 'A reponer' },
  { id: 'imprimir', texto: 'Imprimir' },
  { id: 'estadisticas', texto: 'Estadísticas' },
  { id: 'ajustes', texto: 'Ajustes' },
];

// Wait after a local change before syncing: groups several changes in a row into one send.
const WAIT_AFTER_CHANGE_MS = 3000;
// Time to press "Undo" after a delete. Only then is the real delete written.
const UNDO_WAIT_MS = 5000;

// App state: loads everything from IndexedDB and reads it again after each change.
export function Root({ db }) {
  const [data, setDatos] = useState(null);
  const [device, setDispositivo] = useState('');
  const [syncLogic, setSincronizacion] = useState({ url: '', token: '' });
  const [estadoSync, setEstadoSync] = useState({ estado: 'inactiva', mensaje: '' });
  const [ultimaSync, setUltimaSync] = useState('');
  const [pestana, setPestana] = useState('caducidad');
  const [view2, setVista] = useState(null); // Is a cache entry still valid? "ahora" is passed to be able to test it.
  const [notice, setAviso] = useState(null);
  const [error, setError] = useState('');
  // Ids of lots and products with a pending delete: they are hidden until confirmed or undone.
  const [ocultos, setOcultos] = useState(() => new Set());
  const timer = useRef(null);
  const syncRunning = useRef(false);
  const pendingDeletes = useRef(new Map());

  // optional action: { etiqueta, onClick } to show a button in the notice (e.g. «Undo»).
  const notifyUser = useCallback((text, type = 'info', accion = null) => {
    setAviso({ texto: text, tipo: type, id: Date.now(), accion });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setDatos(await loadAll(db));
    } catch (e) {
      setError(`No se pudieron leer los datos: ${e.message}`);
    }
  }, [db]);

  // Sync: one at a time, and only if a URL and token are saved.
  const syncNow = useCallback(async (config = syncLogic, id = device) => {
    if (!config.url || !config.token || !id) {
      setEstadoSync({ estado: 'inactiva', mensaje: 'Sin configurar: pega la URL y el token de Apps Script.' });
      return;
    }
    if (syncRunning.current) return;
    if (!navigator.onLine) {
      setEstadoSync({ estado: 'sin-conexion', mensaje: 'Sin conexión: los cambios se enviarán al volver.' });
      return;
    }
    syncRunning.current = true;
    setEstadoSync((e) => ({ ...e, estado: 'sincronizando', mensaje: 'Sincronizando…' }));
    try {
      const r = await syncAll(db, { url: config.url, token: config.token, dispositivo: id, fetchFn: fetch });
      const sent = r.datos.enviadas;
      setUltimaSync(r.datos.ahora);
      setEstadoSync({
        estado: 'ok',
        mensaje: `Sincronizado. Enviadas ${sent}, recibidas ${r.datos.recibidos}, fotos subidas ${r.fotos.subidas}.`
          + (r.fotos.errores.length ? ` Fotos con error: ${r.fotos.errores.length}.` : ''),
      });
      await loadData();
    } catch (e) {
      if (e instanceof Offline) {
        setEstadoSync({ estado: 'sin-conexion', mensaje: e.message });
      } else {
        setEstadoSync({ estado: 'error', mensaje: e.message });
        notifyUser(`Sincronización: ${e.message}`, 'error');
      }
    } finally {
      syncRunning.current = false;
    }
  }, [db, device, syncLogic, loadData, notifyUser]);

  // After a local change: reload and schedule a sync within a few seconds.
  const refresh = useCallback(() => {
    loadData();
    // Con un móvil conectado por sala, el cambio llega al momento al otro.
    enviarCambiosPendientes().catch(() => {});
    clearTimeout(timer.current);
    timer.current = setTimeout(() => syncNow(), WAIT_AFTER_CHANGE_MS);
  }, [loadData, syncNow]);

  // Delete with "Undo": it is hidden right away and, if a few seconds pass without undoing, it is written.
  const requestDelete = useCallback(({ tipo: type, id, texto: text }) => {
    setOcultos((previousSet) => new Set(previousSet).add(id));
    const show = () => setOcultos((previousSet) => {
      const nextSet = new Set(previousSet);
      nextSet.delete(id);
      return nextSet;
    });
    const write = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      try {
        if (type === 'lote') await removeLot(db, device, id);
        else await removeProduct(db, device, id);
      } catch (e) {
        notifyUser(`No se pudo borrar: ${e.message}`, 'error');
      } finally {
        show();
        refresh();
      }
    }, UNDO_WAIT_MS);
    pendingDeletes.current.set(id, write);
    notifyUser(text, 'info', {
      etiqueta: 'Deshacer',
      onClick: () => {
        clearTimeout(write);
        pendingDeletes.current.delete(id);
        show();
        setAviso(null);
      },
    });
  }, [db, device, notifyUser, refresh]);

  useEffect(() => {
    (async () => {
      const id = await deviceId(db);
      setDispositivo(id);
      const config = {
        url: await readMeta(db, 'sync_url'),
        token: await readMeta(db, 'sync_token'),
      };
      setSincronizacion(config);
      setUltimaSync(await readMeta(db, 'ultima_sincronizacion'));
      await loadData();
      return { config, id };
    })().then(({ config, id }) => {
      // When the app opens, if there is connection and configuration, it syncs.
      if (config.url && config.token) setTimeout(() => syncNow(config, id), 0);
    }).catch((e) => setError(`No se pudo abrir la base de datos: ${e.message}`));
  }, [db, loadData]);

  // Al abrir la app, vuelve a abrir la sala guardada aunque la pestaña de Ajustes no esté visible.
  useEffect(() => {
    if (device) restaurarSala({ db, deviceId: device, token: syncLogic.token, refresh });
  }, [db, device, syncLogic.token, refresh]);

  // When the connection comes back, sync what is pending.
  useEffect(() => {
    const onOnline = () => syncNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow]);

  // Another app version has updated the database: this tab can no longer save.
  useEffect(() => {
    const onVersionChange = () => setError('Hay una versión nueva de la app. Recarga la página para seguir (no se pierde nada guardado).');
    globalThis.addEventListener('bd-version-nueva', onVersionChange);
    return () => globalThis.removeEventListener('bd-version-nueva', onVersionChange);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setAviso(null), notice.accion ? UNDO_WAIT_MS : 3000);
    return () => clearTimeout(t);
  }, [notice]);

  if (error) return html`<${Notice} tipo="error">${error}<//>`;
  if (!data) return html`<p class="cargando">Cargando…</p>`;

  const config = effectiveSettings(data.configuracion);
  const close = () => setVista(null);
  const onDone = () => { close(); refresh(); };
  const pending = data.operaciones.length;

  // What is seen: without the lots and products with a pending delete (nor the lots of a hidden product).
  const visible = {
    ...data,
    productos: data.productos.filter((p) => !ocultos.has(p.id)),
    lotes: data.lotes.filter((l) => !ocultos.has(l.id) && !ocultos.has(l.producto_id)),
  };

  const screen = {
    caducidad: html`<${ExpiryScreen} db=${db} dispositivo=${device} datos=${visible} config=${config}
      notificar=${notifyUser} refrescar=${refresh} onEditarLote=${(lot) => setVista({ tipo: 'editar-lote', lote: lot })} />`,
    stock: html`<${StockScreen} datos=${visible} config=${config}
      onAbrirProducto=${(product) => setVista({ tipo: 'producto', producto: product })} />`,
    reponer: html`<${RestockScreen} datos=${visible} onComprado=${(product) => setVista({ tipo: 'alta', producto: product })} />`,
    imprimir: html`<${PrintScreen} db=${db} datos=${visible} />`,
    estadisticas: html`<${StatisticsScreen} datos=${visible} />`,
    ajustes: html`<${SettingsScreen} db=${db} dispositivo=${device} config=${config}
      notificar=${notifyUser} refrescar=${refresh} sincronizacion=${syncLogic}
      estadoSync=${estadoSync} ultimaSync=${ultimaSync} pendientes=${pending}
      onToken=${(token) => setSincronizacion((prev) => ({ ...prev, token }))} />`,
  }[pestana];

  let modal = null;
  if (view2?.tipo === 'alta') {
    modal = html`<section class="modal-pantalla"><${LotForm} db=${db} dispositivo=${device} datos=${visible} config=${config}
      productoInicial=${view2.producto} notificar=${notifyUser} onHecho=${onDone} onCancelar=${close} /></section>`;
  } else if (view2?.tipo === 'producto') {
    const product = visible.productos.find((p) => p.id === view2.producto.id);
    if (product && !product.borrado) {
      modal = html`<${ProductDetail} db=${db} dispositivo=${device} datos=${visible} config=${config} producto=${product}
        notificar=${notifyUser} refrescar=${refresh} onCerrar=${close} solicitarBorrado=${requestDelete}
        onAnadirLote=${(p) => setVista({ tipo: 'alta', producto: p })}
        onEditarLote=${(lot) => setVista({ tipo: 'editar-lote', lote: lot, desde: 'producto', producto: product })} />`;
    }
  } else if (view2?.tipo === 'editar-lote') {
    const lot = visible.lotes.find((l) => l.id === view2.lote.id);
    const product = lot && visible.productos.find((p) => p.id === lot.producto_id);
    if (lot && product && !lot.borrado) {
      modal = html`<${EditLot} db=${db} dispositivo=${device} lote=${lot} producto=${product} config=${config}
        notificar=${notifyUser} onHecho=${onDone} onCerrar=${close} solicitarBorrado=${requestDelete} />`;
    }
  }

  return html`
    <div class="app">
      <div class="pantallas">${screen}</div>

      ${modal}

      <button type="button" class="fab" aria-label="Añadir lote" onClick=${() => setVista({ tipo: 'alta' })}>+</button>

      ${notice && (notice.accion
        ? html`<button type="button" class=${`toast toast-accion ${notice.tipo}`} role="status" key=${notice.id} onClick=${notice.accion.onClick}>
            <span>${notice.texto}</span> <strong>${notice.accion.etiqueta}</strong>
          </button>`
        : html`<div class=${`toast ${notice.tipo}`} role="status" key=${notice.id}>${notice.texto}</div>`)}

      <nav class="barra" aria-label="Pantallas">
        ${TABS.map((p) => html`
          <button type="button" class=${`barra-boton ${pestana === p.id ? 'activa' : ''}`}
            aria-current=${pestana === p.id ? 'page' : null}
            onClick=${() => { setPestana(p.id); setVista(null); }}>${p.texto}</button>`)}
      </nav>
    </div>
  `;
}
