import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field } from './components.js';
import { QrScannerModal } from './scanner.js';
import { applyPeerOperations, createRoom, joinRoom } from '../datos/peer-link.js';
import { readMeta, saveMeta } from '../datos/store.js';
import { decodeInvite, encodeInvite } from '../logica/peer-sync.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ESPERA_REUNION_MS = 2000;
const CLAVE_TOKEN = 'sync_token';
const CLAVE_SALA = 'sala_casa';

// La sala vive fuera de la pantalla: cambiar de pestaña no la cierra.
// Estado compartido del módulo: la sala, su rol y su código, y lo que muestra el bloque.
let contexto = { db: null, deviceId: null, refresh: () => {} };
let sala = null;
let reintento = null;
let restaurada = false;
let estado = { rol: null, codigo: '', status: 'Sin conectar.' };
const oyentes = new Set();

function emitir(parcial) {
  estado = { ...estado, ...parcial };
  for (const avisar of oyentes) avisar(estado);
}

const alRecibir = async (operaciones) => {
  const n = await applyPeerOperations(contexto.db, contexto.deviceId, operaciones);
  if (n > 0) contexto.refresh();
  emitir({ status: `Conectado. Operaciones recibidas aplicadas: ${n}.` });
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
  emitir({ rol: null, codigo: '', status: 'Sin conectar.' });
  saveMeta(contexto.db, CLAVE_SALA, null);
}

function codigoNuevo() {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
}

// Código QR generado en el navegador (sin servicios externos).
function Qr({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !text || !window.ZXingBrowser) return;
    const writer = new window.ZXingBrowser.BrowserQRCodeSvgWriter();
    ref.current.replaceChildren(writer.write(text, 180, 180));
  }, [text]);
  return html`<div class="qr" ref=${ref} role="img" aria-label="Código QR para entrar en la sala"></div>`;
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

// Sincronización entre dos móviles en la misma red, en tres pasos:
// 1) guardar el token, 2) crear sala (anfitrión), 3) entrar en sala (con QR o código).
export function SyncBlock({ db, deviceId, token, onToken, refresh }) {
  const [vista, setVista] = useState(estado);
  const [tokenTyped, setTokenTyped] = useState('');
  const [codeTyped, setCodeTyped] = useState('');
  const [scanning, setScanning] = useState(false);
  const [mensajeToken, setMensajeToken] = useState('');
  const arrancadoRef = useRef(false);

  // El bloque se suscribe a la sala; desmontarlo no la cierra.
  contexto = { db, deviceId, refresh };
  useEffect(() => {
    oyentes.add(setVista);
    return () => oyentes.delete(setVista);
  }, []);

  const guardarToken = async (nuevo) => {
    const limpio = nuevo.trim();
    if (!limpio) return setMensajeToken('El token no puede estar vacío.');
    await saveMeta(db, CLAVE_TOKEN, limpio);
    onToken(limpio);
    setMensajeToken('Token guardado.');
  };

  // Entrar con un QR: trae la sala y el token. Si el token de este móvil es otro, se usa el del QR.
  const alEscanear = async (texto) => {
    setScanning(false);
    const invitacion = decodeInvite(texto);
    if (!invitacion) {
      // Código de sala escrito a mano en el escáner.
      const soloCodigo = texto.trim().toUpperCase();
      if (soloCodigo.length !== 6 || !token) return emitir({ status: 'Ese QR no es de una sala de inventario.' });
      return unirseSala(soloCodigo, token);
    }
    if (invitacion.token !== token) {
      await guardarToken(invitacion.token);
      setMensajeToken('Token tomado del QR.');
    }
    unirseSala(invitacion.code, invitacion.token);
  };

  const entrarConCodigo = (event) => {
    event.preventDefault();
    const limpio = codeTyped.trim().toUpperCase();
    if (limpio.length !== 6) return emitir({ status: 'El código tiene 6 caracteres.' });
    if (!token) return emitir({ status: 'Primero guarda el token (paso 1).' });
    unirseSala(limpio, token);
  };

  const { rol, codigo, status } = vista;
  const inviteText = codigo && token ? encodeInvite({ code: codigo, token }) : '';

  return html`
    <div class="bloque" data-testid="sincronizacion-casa">
      <h3>Sincronizar entre móviles</h3>
      <p class="secundario">Los dos móviles tienen que estar en la misma Wi-Fi y con el mismo token.</p>

      <div class="bloque-paso">
        <strong>1. Token</strong>
        <p class="secundario">${token ? 'Token guardado. Pon el mismo en el otro móvil (o escanea su QR).' : 'Escribe un token y guárdalo. Es el mismo en los dos móviles.'}</p>
        <form class="fila" onSubmit=${(e) => { e.preventDefault(); guardarToken(tokenTyped); }}>
          <${Field} etiqueta="Token">
            <input type="password" autocomplete="off" value=${tokenTyped} onInput=${(e) => setTokenTyped(e.currentTarget.value)} />
          <//>
          <${Button} tipo="secundario" type="submit">Guardar token<//>
        </form>
        ${mensajeToken && html`<p class="secundario">${mensajeToken}</p>`}
      </div>

      <div class="bloque-paso">
        <strong>2. Crear sala</strong>
        <p class="secundario">En un móvil. Muestra un QR con la sala y el token.</p>
        ${rol !== 'anfitrion' && html`<div class="acciones"><${Button} tipo="secundario" disabled=${!token || rol !== null} onClick=${() => crearSala(codigoNuevo(), token)}>Crear sala<//></div>`}
        ${rol === 'anfitrion' && html`
          <${Qr} text=${inviteText} />
          <p class="codigo" data-testid="codigo-sala">${codigo}</p>`}
      </div>

      <div class="bloque-paso">
        <strong>3. Entrar en sala</strong>
        <p class="secundario">En el otro móvil. Escanea el QR o escribe el código.</p>
        <div class="acciones">
          <${Button} tipo="secundario" disabled=${rol !== null} onClick=${() => setScanning(true)}>Escanear QR<//>
        </div>
        <form class="fila" onSubmit=${entrarConCodigo}>
          <input value=${codeTyped} maxlength="6" autocomplete="off" aria-label="Código de la sala" disabled=${rol !== null} onInput=${(e) => setCodeTyped(e.currentTarget.value)} />
          <${Button} tipo="secundario" type="submit" disabled=${rol !== null}>Entrar<//>
        </form>
      </div>

      <p class="secundario" data-testid="estado-casa" role="status">${status}</p>
      ${rol !== null && html`<div class="acciones"><${Button} tipo="secundario" onClick=${salirSala}>Salir de la sala<//></div>`}
      ${scanning && html`<${QrScannerModal} onCodigo=${alEscanear} onCerrar=${() => setScanning(false)} />`}
    </div>`;
}
