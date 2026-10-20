import { html } from 'htm/preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Aviso } from './componentes.js';
import { AltaLote, DetalleProducto, EditarLote } from './formularios.js';
import { PantallaAjustes, PantallaCaducidad, PantallaImprimir, PantallaReponer, PantallaStock } from './pantallas.js';
import { borrarLote, borrarProducto, cargarTodo, dispositivoId, leerMeta } from '../datos/tienda.js';
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
// Tiempo para pulsar «Deshacer» tras un borrado. Solo después se escribe el borrado de verdad.
const ESPERA_DESHACER_MS = 5000;

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
  // Ids de lotes y productos con un borrado pendiente: se ocultan hasta que se confirma o se deshace.
  const [ocultos, setOcultos] = useState(() => new Set());
  const temporizador = useRef(null);
  const sincroEnCurso = useRef(false);
  const borradosPendientes = useRef(new Map());

  // accion opcional: { etiqueta, onClick } para mostrar un botón en el aviso (p. ej. «Deshacer»).
  const notificar = useCallback((texto, tipo = 'info', accion = null) => {
    setAviso({ texto, tipo, id: Date.now(), accion });
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

  // Borrado con «Deshacer»: se oculta enseguida y, si pasan unos segundos sin deshacer, se escribe.
  const solicitarBorrado = useCallback(({ tipo, id, texto }) => {
    setOcultos((previos) => new Set(previos).add(id));
    const mostrar = () => setOcultos((previos) => {
      const siguientes = new Set(previos);
      siguientes.delete(id);
      return siguientes;
    });
    const escribir = setTimeout(async () => {
      borradosPendientes.current.delete(id);
      try {
        if (tipo === 'lote') await borrarLote(db, dispositivo, id);
        else await borrarProducto(db, dispositivo, id);
      } catch (e) {
        notificar(`No se pudo borrar: ${e.message}`, 'error');
      } finally {
        mostrar();
        refrescar();
      }
    }, ESPERA_DESHACER_MS);
    borradosPendientes.current.set(id, escribir);
    notificar(texto, 'info', {
      etiqueta: 'Deshacer',
      onClick: () => {
        clearTimeout(escribir);
        borradosPendientes.current.delete(id);
        mostrar();
        setAviso(null);
      },
    });
  }, [db, dispositivo, notificar, refrescar]);

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
    const t = setTimeout(() => setAviso(null), aviso.accion ? ESPERA_DESHACER_MS : 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (error) return html`<${Aviso} tipo="error">${error}<//>`;
  if (!datos) return html`<p class="cargando">Cargando…</p>`;

  const config = configuracionEfectiva(datos.configuracion);
  const cerrar = () => setVista(null);
  const alHacer = () => { cerrar(); refrescar(); };
  const pendientes = datos.operaciones.length;

  // Lo que se ve: sin los lotes y productos con un borrado pendiente (ni los lotes de un producto oculto).
  const visibles = {
    ...datos,
    productos: datos.productos.filter((p) => !ocultos.has(p.id)),
    lotes: datos.lotes.filter((l) => !ocultos.has(l.id) && !ocultos.has(l.producto_id)),
  };

  const pantalla = {
    caducidad: html`<${PantallaCaducidad} db=${db} dispositivo=${dispositivo} datos=${visibles} config=${config}
      notificar=${notificar} refrescar=${refrescar} onEditarLote=${(lote) => setVista({ tipo: 'editar-lote', lote })} />`,
    stock: html`<${PantallaStock} datos=${visibles} config=${config}
      onAbrirProducto=${(producto) => setVista({ tipo: 'producto', producto })} />`,
    reponer: html`<${PantallaReponer} datos=${visibles} onComprado=${(producto) => setVista({ tipo: 'alta', producto })} />`,
    imprimir: html`<${PantallaImprimir} db=${db} datos=${visibles} />`,
    ajustes: html`<${PantallaAjustes} db=${db} dispositivo=${dispositivo} config=${config}
      notificar=${notificar} refrescar=${refrescar} sincronizacion=${sincronizacion}
      estadoSync=${estadoSync} ultimaSync=${ultimaSync} pendientes=${pendientes}
      onGuardarSincro=${(nueva) => { setSincronizacion(nueva); sincronizarAhora(nueva); }}
      onSincronizar=${() => sincronizarAhora()} />`,
  }[pestana];

  let modal = null;
  if (vista?.tipo === 'alta') {
    modal = html`<section class="modal-pantalla"><${AltaLote} db=${db} dispositivo=${dispositivo} datos=${visibles} config=${config}
      productoInicial=${vista.producto} notificar=${notificar} onHecho=${alHacer} onCancelar=${cerrar} /></section>`;
  } else if (vista?.tipo === 'producto') {
    const producto = visibles.productos.find((p) => p.id === vista.producto.id);
    if (producto && !producto.borrado) {
      modal = html`<${DetalleProducto} db=${db} dispositivo=${dispositivo} datos=${visibles} config=${config} producto=${producto}
        notificar=${notificar} refrescar=${refrescar} onCerrar=${cerrar} solicitarBorrado=${solicitarBorrado}
        onAnadirLote=${(p) => setVista({ tipo: 'alta', producto: p })}
        onEditarLote=${(lote) => setVista({ tipo: 'editar-lote', lote, desde: 'producto', producto })} />`;
    }
  } else if (vista?.tipo === 'editar-lote') {
    const lote = visibles.lotes.find((l) => l.id === vista.lote.id);
    const producto = lote && visibles.productos.find((p) => p.id === lote.producto_id);
    if (lote && producto && !lote.borrado) {
      modal = html`<${EditarLote} db=${db} dispositivo=${dispositivo} lote=${lote} producto=${producto} config=${config}
        notificar=${notificar} onHecho=${alHacer} onCerrar=${cerrar} solicitarBorrado=${solicitarBorrado} />`;
    }
  }

  return html`
    <div class="app">
      <div class="pantallas">${pantalla}</div>

      ${modal}

      <button type="button" class="fab" aria-label="Añadir lote" onClick=${() => setVista({ tipo: 'alta' })}>+</button>

      ${aviso && (aviso.accion
        ? html`<button type="button" class=${`toast toast-accion ${aviso.tipo}`} role="status" key=${aviso.id} onClick=${aviso.accion.onClick}>
            <span>${aviso.texto}</span> <strong>${aviso.accion.etiqueta}</strong>
          </button>`
        : html`<div class=${`toast ${aviso.tipo}`} role="status" key=${aviso.id}>${aviso.texto}</div>`)}

      <nav class="barra" aria-label="Pantallas">
        ${PESTANAS.map((p) => html`
          <button type="button" class=${`barra-boton ${pestana === p.id ? 'activa' : ''}`}
            aria-current=${pestana === p.id ? 'page' : null}
            onClick=${() => { setPestana(p.id); setVista(null); }}>${p.texto}</button>`)}
      </nav>
    </div>
  `;
}
