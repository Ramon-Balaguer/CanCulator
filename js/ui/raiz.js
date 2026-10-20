import { html } from 'htm/preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Aviso } from './componentes.js';
import { AltaLote, DetalleProducto, EditarLote } from './formularios.js';
import { PantallaAjustes, PantallaCaducidad, PantallaImprimir, PantallaReponer, PantallaStock } from './pantallas.js';
import { cargarTodo, dispositivoId, leerMeta } from '../datos/tienda.js';
import { sincronizarTodo, SinConexion } from '../datos/sincro.js';
import { configuracionEfectiva } from '../logica/configuracion.js';

const PESTANAS = [
  { id: 'caducidad', texto: 'Caducidad' },
  { id: 'stock', texto: 'Stock' },
  { id: 'reponer', texto: 'A reponer' },
  { id: 'imprimir', texto: 'Imprimir' },
  { id: 'ajustes', texto: 'Ajustes' },
];

// Espera tras un cambio local antes de sincronizar: agrupa varios cambios seguidos en un envío.
const ESPERA_TRAS_CAMBIO_MS = 3000;

// Estado de la app: carga todo desde IndexedDB y lo vuelve a leer después de cada cambio.
export function Raiz({ db }) {
  const [datos, setDatos] = useState(null);
  const [dispositivo, setDispositivo] = useState('');
  const [sincronizacion, setSincronizacion] = useState({ url: '', token: '' });
  const [estadoSync, setEstadoSync] = useState({ estado: 'inactiva', mensaje: '' });
  const [ultimaSync, setUltimaSync] = useState('');
  const [pestana, setPestana] = useState('caducidad');
  const [vista, setVista] = useState(null); // { tipo, ... } para modales y formularios
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState('');
  const temporizador = useRef(null);
  const sincroEnCurso = useRef(false);

  const notificar = useCallback((texto, tipo = 'info') => {
    setAviso({ texto, tipo, id: Date.now() });
  }, []);

  const cargarDatos = useCallback(async () => {
    try {
      setDatos(await cargarTodo(db));
    } catch (e) {
      setError(`No se pudieron leer los datos: ${e.message}`);
    }
  }, [db]);

  // Sincronización: una a la vez, y solo si hay URL y token guardados.
  const sincronizarAhora = useCallback(async (config = sincronizacion, id = dispositivo) => {
    if (!config.url || !config.token || !id) {
      setEstadoSync({ estado: 'inactiva', mensaje: 'Sin configurar: pega la URL y el token de Apps Script.' });
      return;
    }
    if (sincroEnCurso.current) return;
    if (!navigator.onLine) {
      setEstadoSync({ estado: 'sin-conexion', mensaje: 'Sin conexión: los cambios se enviarán al volver.' });
      return;
    }
    sincroEnCurso.current = true;
    setEstadoSync((e) => ({ ...e, estado: 'sincronizando', mensaje: 'Sincronizando…' }));
    try {
      const r = await sincronizarTodo(db, { url: config.url, token: config.token, dispositivo: id, fetchFn: fetch });
      const enviadas = r.datos.enviadas;
      setUltimaSync(r.datos.ahora);
      setEstadoSync({
        estado: 'ok',
        mensaje: `Sincronizado. Enviadas ${enviadas}, recibidas ${r.datos.recibidos}, fotos subidas ${r.fotos.subidas}.`
          + (r.fotos.errores.length ? ` Fotos con error: ${r.fotos.errores.length}.` : ''),
      });
      await cargarDatos();
    } catch (e) {
      if (e instanceof SinConexion) {
        setEstadoSync({ estado: 'sin-conexion', mensaje: e.message });
      } else {
        setEstadoSync({ estado: 'error', mensaje: e.message });
        notificar(`Sincronización: ${e.message}`, 'error');
      }
    } finally {
      sincroEnCurso.current = false;
    }
  }, [db, dispositivo, sincronizacion, cargarDatos, notificar]);


  // Tras un cambio local: recargar y programar una sincronización dentro de unos segundos.
  const refrescar = useCallback(() => {
    cargarDatos();
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => sincronizarAhora(), ESPERA_TRAS_CAMBIO_MS);
  }, [cargarDatos, sincronizarAhora]);

  useEffect(() => {
    (async () => {
      const id = await dispositivoId(db);
      setDispositivo(id);
      const config = {
        url: await leerMeta(db, 'sync_url'),
        token: await leerMeta(db, 'sync_token'),
      };
      setSincronizacion(config);
      setUltimaSync(await leerMeta(db, 'ultima_sincronizacion'));
      await cargarDatos();
      return { config, id };
    })().then(({ config, id }) => {
      // Al abrir la app, si hay conexión y configuración, se sincroniza.
      if (config.url && config.token) setTimeout(() => sincronizarAhora(config, id), 0);
    }).catch((e) => setError(`No se pudo abrir la base de datos: ${e.message}`));
  }, [db, cargarDatos]);

  // Al recuperar la conexión, sincronizar lo pendiente.
  useEffect(() => {
    const alConectar = () => sincronizarAhora();
    window.addEventListener('online', alConectar);
    return () => window.removeEventListener('online', alConectar);
  }, [sincronizarAhora]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (error) return html`<${Aviso} tipo="error">${error}<//>`;
  if (!datos) return html`<p class="cargando">Cargando…</p>`;

  const config = configuracionEfectiva(datos.configuracion);
  const cerrar = () => setVista(null);
  const alHacer = () => { cerrar(); refrescar(); };
  const pendientes = datos.operaciones.length;

  const pantalla = {
    caducidad: html`<${PantallaCaducidad} db=${db} dispositivo=${dispositivo} datos=${datos} config=${config}
      notificar=${notificar} refrescar=${refrescar} onEditarLote=${(lote) => setVista({ tipo: 'editar-lote', lote })} />`,
    stock: html`<${PantallaStock} datos=${datos} config=${config}
      onAbrirProducto=${(producto) => setVista({ tipo: 'producto', producto })} />`,
    reponer: html`<${PantallaReponer} datos=${datos} onComprado=${(producto) => setVista({ tipo: 'alta', producto })} />`,
    imprimir: html`<${PantallaImprimir} db=${db} datos=${datos} />`,
    ajustes: html`<${PantallaAjustes} db=${db} dispositivo=${dispositivo} config=${config}
      notificar=${notificar} refrescar=${refrescar} sincronizacion=${sincronizacion}
      estadoSync=${estadoSync} ultimaSync=${ultimaSync} pendientes=${pendientes}
      onGuardarSincro=${(nueva) => { setSincronizacion(nueva); sincronizarAhora(nueva); }}
      onSincronizar=${() => sincronizarAhora()} />`,
  }[pestana];

  let modal = null;
  if (vista?.tipo === 'alta') {
    modal = html`<section class="modal-pantalla"><${AltaLote} db=${db} dispositivo=${dispositivo} datos=${datos} config=${config}
      productoInicial=${vista.producto} notificar=${notificar} onHecho=${alHacer} onCancelar=${cerrar} /></section>`;
  } else if (vista?.tipo === 'producto') {
    const producto = datos.productos.find((p) => p.id === vista.producto.id);
    if (producto && !producto.borrado) {
      modal = html`<${DetalleProducto} db=${db} dispositivo=${dispositivo} datos=${datos} config=${config} producto=${producto}
        notificar=${notificar} refrescar=${refrescar} onCerrar=${cerrar}
        onAnadirLote=${(p) => setVista({ tipo: 'alta', producto: p })}
        onEditarLote=${(lote) => setVista({ tipo: 'editar-lote', lote, desde: 'producto', producto })} />`;
    }
  } else if (vista?.tipo === 'editar-lote') {
    const lote = datos.lotes.find((l) => l.id === vista.lote.id);
    const producto = lote && datos.productos.find((p) => p.id === lote.producto_id);
    if (lote && producto && !lote.borrado) {
      modal = html`<${EditarLote} db=${db} dispositivo=${dispositivo} lote=${lote} producto=${producto} config=${config}
        notificar=${notificar} onHecho=${alHacer} onCerrar=${cerrar} />`;
    }
  }

  return html`
    <div class="app">
      <div class="pantallas">${pantalla}</div>

      ${modal}

      <button type="button" class="fab" aria-label="Añadir lote" onClick=${() => setVista({ tipo: 'alta' })}>+</button>

      ${aviso && html`<div class=${`toast ${aviso.tipo}`} role="status" key=${aviso.id}>${aviso.texto}</div>`}

      <nav class="barra" aria-label="Pantallas">
        ${PESTANAS.map((p) => html`
          <button type="button" class=${`barra-boton ${pestana === p.id ? 'activa' : ''}`}
            aria-current=${pestana === p.id ? 'page' : null}
            onClick=${() => { setPestana(p.id); setVista(null); }}>${p.texto}</button>`)}
      </nav>
    </div>
  `;
}
