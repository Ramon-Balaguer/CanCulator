import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button } from './components.js';
import { QrScannerModal } from './scanner.js';
import { applyPeerOperations, createRoom, joinRoom } from '../datos/peer-link.js';
import { readMeta, saveMeta } from '../datos/store.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ESPERA_REUNION_MS = 10000;
const CLAVE_SALA = 'sala_casa';

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
  return html`<div class="qr" ref=${ref} role="img" aria-label=${`Código QR de la sala ${text}`}></div>`;
}

// Sincronización entre dos móviles en la misma red. Necesita el mismo token en los dos.
// La sala se guarda: al abrir la app se vuelve a abrir (anfitrión) o a unir (invitado) sola.
export function PeerSyncBlock({ db, deviceId, token, refresh }) {
  const [code, setCode] = useState('');
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState('Sin conectar.');
  const [scanning, setScanning] = useState(false);
  const [typed, setTyped] = useState('');
  const salaRef = useRef(null);
  const reintentoRef = useRef(null);
  const arrancadoRef = useRef(false);

  const onOps = async (operations) => {
    const n = await applyPeerOperations(db, deviceId, operations);
    if (n > 0) refresh();
    setStatus(`Conectado. Operaciones recibidas aplicadas: ${n}.`);
  };

  const cerrarSala = () => {
    clearTimeout(reintentoRef.current);
    salaRef.current?.cerrar();
    salaRef.current = null;
  };

  const unirse = (codigo, rol) => {
    cerrarSala();
    const reintentar = () => {
      if (!codigo) return;
      reintentoRef.current = setTimeout(() => unirse(codigo, 'invitado'), ESPERA_REUNION_MS);
    };
    salaRef.current = joinRoom({ db, code: codigo, token, onOps, onStatus: setStatus, onClosed: reintentar });
    setCode(codigo);
    setRole(rol);
    saveMeta(db, CLAVE_SALA, { codigo, rol });
  };

  const crear = (codigo) => {
    cerrarSala();
    salaRef.current = createRoom({ db, code: codigo, token, onOps, onStatus: setStatus });
    setCode(codigo);
    setRole('anfitrion');
    saveMeta(db, CLAVE_SALA, { codigo, rol: 'anfitrion' });
  };

  const cerrar = () => {
    cerrarSala();
    setCode('');
    setRole(null);
    setStatus('Sin conectar.');
    saveMeta(db, CLAVE_SALA, null);
  };

  // Al tener token, restaurar la sala guardada (una sola vez).
  useEffect(() => {
    if (!token || arrancadoRef.current) return;
    arrancadoRef.current = true;
    readMeta(db, CLAVE_SALA).then((guardada) => {
      if (!guardada?.codigo) return;
      if (guardada.rol === 'anfitrion') crear(guardada.codigo);
      else unirse(guardada.codigo, 'invitado');
    });
  }, [token]);

  useEffect(() => () => cerrarSala(), []);

  if (!token) {
    return html`<div class="bloque" data-testid="sincronizacion-casa">
      <h3>Sincronizar entre móviles (misma Wi-Fi)</h3>
      <p class="secundario">Primero configura el token (arriba).</p>
    </div>`;
  }

  const unirseConTexto = (event) => {
    event.preventDefault();
    const codigo = typed.trim().toUpperCase();
    if (codigo.length === 6) unirse(codigo, 'invitado');
    else setStatus('El código tiene 6 caracteres.');
  };

  return html`
    <div class="bloque" data-testid="sincronizacion-casa">
      <h3>Sincronizar entre móviles (misma Wi-Fi)</h3>
      <p class="secundario">Los dos móviles tienen que tener el mismo token y estar en la misma red.</p>
      ${role === null && html`
        <div class="acciones">
          <${Button} tipo="secundario" onClick=${() => crear(codigoNuevo())}>Crear sala<//>
          <${Button} tipo="secundario" onClick=${() => setScanning(true)}>Escanear QR de la sala<//>
        </div>
        <form class="fila" onSubmit=${unirseConTexto}>
          <input value=${typed} maxlength="6" autocomplete="off" aria-label="Código de la sala" onInput=${(e) => setTyped(e.currentTarget.value)} />
          <${Button} tipo="secundario" type="submit">Unirse<//>
        </form>`}
      ${role === 'anfitrion' && html`
        <p>Pide al otro móvil que escanee este QR o escriba el código:</p>
        <${Qr} text=${code} />
        <p class="codigo" data-testid="codigo-sala">${code}</p>`}
      <p class="secundario" data-testid="estado-casa" role="status">${status}</p>
      ${role !== null && html`<div class="acciones"><${Button} tipo="secundario" onClick=${cerrar}>Cerrar sala<//></div>`}
      ${scanning && html`<${QrScannerModal} onCodigo=${(c) => { setScanning(false); unirse(c, 'invitado'); }} onCerrar=${() => setScanning(false)} />`}
    </div>`;
}
