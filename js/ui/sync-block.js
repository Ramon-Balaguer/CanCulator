import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field } from './components.js';
import { QrScannerModal } from './scanner.js';
import { alCambiarConectadas, applyPeerOperations, createRoom, joinRoom, numeroConectadas } from '../datos/peer-link.js';
import { readMeta, saveMeta } from '../datos/store.js';
import { encodeInvite } from '../logica/peer-sync.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ESPERA_REUNION_MS = 1000;
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
    if (!limpia) return setMensajeMain('La password no puede estar vacía.');
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
      <h3>Sincronizar entre móviles</h3>
      <p class="secundario">Los dos móviles tienen que estar en la misma Wi-Fi.</p>

      <div class="bloque" data-testid="crear-main">
        <h3>Crear main</h3>
        <p class="secundario" data-testid="explicacion-password">La password de sincronización protege tu inventario: solo entra en la sala quien la tenga.
          Pon la misma en todos los móviles de la casa y no la compartas fuera de ella.</p>
        ${rol === 'anfitrion' && html`
          <${Qr} text=${inviteText} />
          <p class="codigo" data-testid="codigo-sala">${codigo}</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${salirSala}>Cerrar sala<//></div>`}
        ${rol === null && html`
          <form class="formulario" onSubmit=${crearMain}>
            <${Field} etiqueta="Password de sincronización">
              <input type="password" autocomplete="off" value=${passwordTyped} onInput=${(e) => setPasswordTyped(e.currentTarget.value)} />
            <//>
            <${Button} tipo="secundario" type="submit">Guardar y crear sala<//>
          </form>
          ${mensajeMain && html`<p class="secundario">${mensajeMain}</p>`}`}
        ${rol === 'invitado' && html`<p class="secundario">Este móvil ya está en una sala como cliente. Sal de ella para crear el main.</p>`}
      </div>

      <div class="bloque" data-testid="crear-cliente">
        <h3>Crear cliente</h3>
        ${rol === null && html`
          <p class="secundario">En el otro móvil, escanea el QR del main o haz una foto. Luego pon la password.</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${() => setScanning(true)}>Escanear QR<//></div>`}
        ${rol === 'invitado' && html`
          <p class="secundario">Conectado a la sala <span class="codigo-pequeno">${codigo}</span>.</p>
          <div class="acciones"><${Button} tipo="secundario" onClick=${salirSala}>Salir de la sala<//></div>`}
        ${rol === 'anfitrion' && html`<p class="secundario">Este móvil es el main. Cierra la sala para conectarlo como cliente.</p>`}
      </div>

      <p class="secundario" data-testid="moviles-conectados">Móviles conectados: ${conectados}</p>
      <p class="secundario" data-testid="estado-casa" role="status">${status}</p>
      ${scanning && html`<${QrScannerModal} passwordInicial=${token ?? ''} onGuardar=${crearCliente} onCerrar=${() => setScanning(false)} />`}
    </div>`;
}
