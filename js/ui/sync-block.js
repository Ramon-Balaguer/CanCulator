import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field } from './components.js';
import { QrScannerModal } from './scanner.js';
import { alCambiarConectadas, applyPeerOperations, createRoom, joinRoom, numeroConectadas } from '../datos/peer-link.js';
import { readMeta, saveMeta } from '../datos/store.js';
import { encodeInvite } from '../logica/peer-sync.js';
import { t } from '../logica/idioma.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ESPERA_REUNION_MS = 1000;
const CLAVE_TOKEN = 'sync_token';
const CLAVE_SALA = 'sala_casa';

// La sala vive fuera de la pantalla: cambiar de pestaña no la cierra.
// Estado compartido del módulo: la sala, su rol y su código, y lo que muestra el bloque.
// El estado es una clave de texto ({ clave, vars }) para traducirlo al pintarlo, o un texto ya escrito.
let contexto = { db: null, deviceId: null, refresh: () => {} };
let sala = null;
let reintento = null;
let restaurada = false;
let estado = { rol: null, codigo: '', status: { clave: 'sincronizar.sin_conectar' } };
const oyentes = new Set();

function emitir(parcial) {
  estado = { ...estado, ...parcial };
  for (const avisar of oyentes) avisar(estado);
}

const alRecibir = async (operaciones) => {
  const n = await applyPeerOperations(contexto.db, contexto.deviceId, operaciones);
  if (n > 0) contexto.refresh();
  emitir({ status: { clave: 'sincronizar.operaciones', vars: { n } } });
};
const alEstado = (status) => emitir({ status });

function cerrarSala() {
  clearTimeout(reintento);
  sala?.cerrar();
  sala = null;
}

function crearSala(codigo, token) {
  cerrarSala();
  sala = createRoom({ db: contexto.db, code: codigo, token, onOps: alRecibir, onFotos: () => contexto.refresh(), onStatus: alEstado });
  emitir({ rol: 'anfitrion', codigo });
  saveMeta(contexto.db, CLAVE_SALA, { codigo, rol: 'anfitrion' });
}

function unirseSala(codigo, token) {
  cerrarSala();
  const reintentar = () => {
    reintento = setTimeout(() => unirseSala(codigo, token), ESPERA_REUNION_MS);
  };
  sala = joinRoom({ db: contexto.db, code: codigo, token, onOps: alRecibir, onFotos: () => contexto.refresh(), onStatus: alEstado, onClosed: reintentar });
  emitir({ rol: 'invitado', codigo });
  saveMeta(contexto.db, CLAVE_SALA, { codigo, rol: 'invitado' });
}

function salirSala() {
  cerrarSala();
  emitir({ rol: null, codigo: '', status: { clave: 'sincronizar.sin_conectar' } });
  saveMeta(contexto.db, CLAVE_SALA, null);
}

function codigoNuevo() {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
}

// Texto del estado: una clave se traduce; un texto ya escrito se muestra tal cual.
function textoEstado(status) {
  return typeof status === 'string' ? status : t(status.clave, status.vars);
}

// Código QR generado en el navegador (sin servicios externos).
function Qr({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !text || !window.ZXingBrowser) return;
    const writer = new window.ZXingBrowser.BrowserQRCodeSvgWriter();
    ref.current.replaceChildren(writer.write(text, 180, 180));
  }, [text]);
  return html`<div class="qr" ref=${ref} role="img" aria-label=${t('sincronizar.qr_alt')}></div>`;
}

// Al arrancar la app (no al abrir Ajustes), vuelve a abrir o unir la sala guardada. Solo una vez.
export function restaurarSala({ db, deviceId, token, refresh }) {
  contexto = { db, deviceId, refresh };
  if (!token || restaurada) return;
  restaurada = true;
  readMeta(db, CLAVE_SALA).then((guardada) => {
    if (!guardada?.codigo) return;
    if (guardada.rol === 'anfitrion') crearSala(guardada.codigo, token);
    else unirseSala(guardada.codigo, token);
  });
}

// Sincronización entre dos móviles en la misma red:
// «Crear main» guarda la password de sincronización y crea la sala; «Crear cliente» entra en ella.
export function SyncBlock({ db, deviceId, token, onToken, refresh }) {
  const [vista, setVista] = useState(estado);
  const [passwordTyped, setPasswordTyped] = useState(token ?? '');
  const [mensajeMain, setMensajeMain] = useState('');
  const [scanning, setScanning] = useState(false);
  const [conectados, setConectados] = useState(numeroConectadas);

  // El bloque se suscribe a la sala; desmontarlo no la cierra.
  contexto = { db, deviceId, refresh };
  useEffect(() => {
    oyentes.add(setVista);
    return () => oyentes.delete(setVista);
  }, []);
  useEffect(() => alCambiarConectadas(setConectados), []);

  const guardarPassword = async (nueva) => {
    await saveMeta(db, CLAVE_TOKEN, nueva);
    onToken(nueva);
  };

  // Main: guarda la password y crea la sala. El QR y el código salen de ahí.
  const crearMain = async (event) => {
    event.preventDefault();
    const limpia = passwordTyped.trim();
    if (!limpia) return setMensajeMain(t('sincronizar.password_vacia'));
    await guardarPassword(limpia);
    setMensajeMain('');
    crearSala(codigoNuevo(), limpia);
  };

  // Cliente: al guardar en el escáner se guarda la password y se entra en la sala.
  const crearCliente = async ({ codigo, password }) => {
    setScanning(false);
    if (password !== token) await guardarPassword(password);
    unirseSala(codigo, password);
  };

  const { rol, codigo, status } = vista;
  const inviteText = codigo && token ? encodeInvite({ code: codigo, token }) : '';

  return html`
    <div class="bloque" data-testid="sincronizacion-casa">
      <h3>${t('sincronizar.titulo')}</h3>
      <p class="secundario">${t('sincronizar.misma_wifi')}</p>

      <div class="bloque" data-testid="crear-main">
        <h3>${t('sincronizar.crear_main')}</h3>
        <p class="secundario" data-testid="explicacion-password">${t('sincronizar.explicacion_password')}</p>
        ${rol === 'anfitrion' && html`
          <${Qr} text=${inviteText} />
          <p class="codigo" data-testid="codigo-sala">${codigo}</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${salirSala}>${t('sincronizar.cerrar_sala')}<//></div>`}
        ${rol === null && html`
          <form class="formulario" onSubmit=${crearMain}>
            <${Field} etiqueta=${t('sincronizar.password')}>
              <input type="password" autocomplete="off" value=${passwordTyped} onInput=${(e) => setPasswordTyped(e.currentTarget.value)} />
            <//>
            <${Button} tipo="secundario" type="submit">${t('sincronizar.guardar_crear')}<//>
          </form>
          ${mensajeMain && html`<p class="secundario">${mensajeMain}</p>`}`}
        ${rol === 'invitado' && html`<p class="secundario">${t('sincronizar.ya_cliente')}</p>`}
      </div>

      <div class="bloque" data-testid="crear-cliente">
        <h3>${t('sincronizar.crear_cliente')}</h3>
        ${rol === null && html`
          <p class="secundario">${t('sincronizar.escanear_intro')}</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${() => setScanning(true)}>${t('btn.escanear_qr')}<//></div>`}
        ${rol === 'invitado' && html`
          <p class="secundario">${t('sincronizar.conectado_a')} <span class="codigo-pequeno">${codigo}</span>.</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${salirSala}>${t('sincronizar.salir')}<//></div>`}
        ${rol === 'anfitrion' && html`<p class="secundario">${t('sincronizar.es_main')}</p>`}
      </div>

      <p class="secundario" data-testid="moviles-conectados">${t('sincronizar.conectados', { n: conectados })}</p>
      <p class="secundario" data-testid="estado-casa" role="status">${textoEstado(status)}</p>
      ${scanning && html`<${QrScannerModal} passwordInicial=${token ?? ''} onGuardar=${crearCliente} onCerrar=${() => setScanning(false)} />`}
    </div>`;
}
