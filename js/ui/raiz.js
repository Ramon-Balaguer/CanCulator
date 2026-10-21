import { html } from 'htm/preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Notice } from './componentes.js';
import { LotForm, ProductDetail, EditLot } from './formularios.js';
import { SettingsScreen, ExpiryScreen, StatisticsScreen, PrintScreen, RestockScreen, StockScreen } from './pantallas.js';
import { removeLot, removeProduct, loadAll, deviceId, readMeta } from '../datos/tienda.js';
import { syncAll, Offline } from '../datos/sincro.js';
import { effectiveSettings } from '../logica/configuracion.js';

const TABS = [
  { id: 'caducidad', texto: 'Caducidad' },
  { id: 'stock', texto: 'Stock' },
  { id: 'reponer', texto: 'A reponer' },
  { id: 'imprimir', texto: 'Imprimir' },
  { id: 'estadisticas', texto: 'Estadísticas' },
  { id: 'ajustes', texto: 'Ajustes' },
];

// Espera tras un cambio local antes de sincronizar: agrupa varios cambios seguidos en un envío.
const WAIT_AFTER_CHANGE_MS = 3000;
// Tiempo para pulsar «Deshacer» tras un borrado. Solo después se escribe el borrado de verdad.
const UNDO_WAIT_MS = 5000;

// Estado de la app: carga todo desde IndexedDB y lo vuelve a leer después de cada cambio.
export function Root({ db }) {
  const [data, setDatos] = useState(null);
  const [device, setDispositivo] = useState('');
  const [syncLogic, setSincronizacion] = useState({ url: '', token: '' });
  const [estadoSync, setEstadoSync] = useState({ estado: 'inactiva', mensaje: '' });
  const [ultimaSync, setUltimaSync] = useState('');
  const [pestana, setPestana] = useState('caducidad');
  const [view2, setVista] = useState(null); // { tipo, ... } para modales y formularios
  const [notice, setAviso] = useState(null);
  const [error, setError] = useState('');
  // Ids de lotes y productos con un borrado pendiente: se ocultan hasta que se confirma o se deshace.
  const [ocultos, setOcultos] = useState(() => new Set());
  const timer = useRef(null);
  const syncRunning = useRef(false);
  const pendingDeletes = useRef(new Map());

  // accion opcional: { etiqueta, onClick } para mostrar un botón en el aviso (p. ej. «Deshacer»).
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

  // Sincronización: una a la vez, y solo si hay URL y token guardados.
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

  // Tras un cambio local: recargar y programar una sincronización dentro de unos segundos.
  const refresh = useCallback(() => {
    loadData();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => syncNow(), WAIT_AFTER_CHANGE_MS);
  }, [loadData, syncNow]);

  // Borrado con «Deshacer»: se oculta enseguida y, si pasan unos segundos sin deshacer, se escribe.
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
      // Al abrir la app, si hay conexión y configuración, se sincroniza.
      if (config.url && config.token) setTimeout(() => syncNow(config, id), 0);
    }).catch((e) => setError(`No se pudo abrir la base de datos: ${e.message}`));
  }, [db, loadData]);

  // Al recuperar la conexión, sincronizar lo pendiente.
  useEffect(() => {
    const onOnline = () => syncNow();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncNow]);

  // Otra versión de la app ha actualizado la base de datos: esta pestaña ya no puede guardar.
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

  // Lo que se ve: sin los lotes y productos con un borrado pendiente (ni los lotes de un producto oculto).
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
      onGuardarSincro=${(next) => { setSincronizacion(next); syncNow(next); }}
      onSincronizar=${() => syncNow()} />`,
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
