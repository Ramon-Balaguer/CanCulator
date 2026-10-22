import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field, Modal, Notice } from './components.js';
import { isValidGtin, normalizeCode } from '../logica/barcode.js';
import { cameraErrorMessage, CAMERA_CONSTRAINTS, PHOTO_NO_CODE_MESSAGE } from '../logica/camera.js';
import { decodeInvite } from '../logica/peer-sync.js';

// Scanner with the camera and, always, manual code entry as a backup.
export function ScannerModal({ onCodigo, onCerrar }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [notice, setAviso] = useState('');

  useEffect(() => {
    let controls = null;
    let closed = false;
    const reader = window.ZXingBrowser?.BrowserMultiFormatOneDReader;
    if (!reader) {
      setError('El lector de códigos no está disponible. Escribe el código a mano.');
      return undefined;
    }
    new reader().decodeFromConstraints(CAMERA_CONSTRAINTS, video.current, (result) => {
      if (!result || closed) return;
      closed = true;
      navigator.vibrate?.(80);
      onCodigo(normalizeCode(result.getText()));
    })
      .then((c) => {
        controls = c;
        if (closed) c.stop();
      })
      .catch((e) => setError(cameraErrorMessage(e)));
    return () => {
      closed = true;
      controls?.stop();
    };
  }, []);

  function sendManual(event) {
    event.preventDefault();
    const code = normalizeCode(manual);
    if (!code) return;
    if (!/^\d{8,14}$/.test(code)) {
      setAviso('Un código de barras tiene entre 8 y 14 dígitos.');
      return;
    }
    if (!isValidGtin(code)) {
      setAviso('Ese código no tiene un dígito de control correcto. Revísalo.');
      return;
    }
    onCodigo(code);
  }

  return html`
    <${Modal} titulo="Escanear código" onCerrar=${onCerrar}>
      <video ref=${video} class="visor" playsinline muted autoplay></video>
      <${Notice} tipo="error">${error}<//>
      <form class="formulario" onSubmit=${sendManual}>
        <${Field} etiqueta="O escribe el código">
          <input inputmode="numeric" autocomplete="off" value=${manual} onInput=${(e) => setManual(e.currentTarget.value)} />
        <//>
        <${Notice} tipo="error">${notice}<//>
        <${Button} type="submit">Usar este código<//>
      </form>
    <//>
  `;
}

// Escáner del QR del main, para crear el cliente. El QR trae la sala y la password: al leerlo,
// se rellenan los dos campos. También se puede hacer una foto del QR. Guardar configura el cliente.
export function QrScannerModal({ passwordInicial, onGuardar, onCerrar }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState(passwordInicial);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');

  // Rellena los campos con el texto de un QR. Devuelve false si no es el QR de un main.
  const rellenar = (texto) => {
    const invitacion = decodeInvite(texto);
    if (!invitacion) {
      setAviso('Ese QR no es de una sala de inventario.');
      return false;
    }
    setCodigo(invitacion.code);
    setPassword(invitacion.token);
    setAviso('');
    return true;
  };

  useEffect(() => {
    let controls = null;
    let closed = false;
    const reader = window.ZXingBrowser?.BrowserQRCodeReader;
    if (!reader) {
      setError('El lector de QR no está disponible. Escribe los datos a mano.');
      return undefined;
    }
    new reader().decodeFromConstraints(CAMERA_CONSTRAINTS, video.current, (result) => {
      if (!result || closed) return;
      if (!rellenar(result.getText())) return;
      closed = true;
      navigator.vibrate?.(80);
      controls?.stop();
    })
      .then((c) => {
        controls = c;
        if (closed) c.stop();
      })
      .catch((e) => setError(cameraErrorMessage(e)));
    return () => {
      closed = true;
      controls?.stop();
    };
  }, []);

  async function leerFoto(event) {
    const foto = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!foto) return;
    const url = URL.createObjectURL(foto);
    try {
      const resultado = await new window.ZXingBrowser.BrowserQRCodeReader().decodeFromImageUrl(url);
      rellenar(resultado.getText());
    } catch {
      setAviso(PHOTO_NO_CODE_MESSAGE);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function guardar(event) {
    event.preventDefault();
    const pass = password.trim();
    const code = codigo.trim().toUpperCase();
    if (!pass) return setAviso('Pon la password de sincronización.');
    if (code.length !== 6) return setAviso('El código de la sala tiene 6 caracteres.');
    onGuardar({ codigo: code, password: pass });
  }

  return html`
    <${Modal} titulo="Escanear QR de la sala" onCerrar=${onCerrar}>
      <video ref=${video} class="visor" playsinline muted autoplay></video>
      <${Notice} tipo="error">${error}<//>
      <form class="formulario" onSubmit=${guardar}>
        <label class="boton secundario">
          Hacer foto del QR
          <input type="file" accept="image/*" capture="environment" class="oculto" onChange=${leerFoto} />
        </label>
        <${Field} etiqueta="Password de sincronización">
          <input type="password" autocomplete="off" value=${password} onInput=${(e) => setPassword(e.currentTarget.value)} />
        <//>
        <${Field} etiqueta="Código de la sala">
          <input autocomplete="off" maxlength="6" value=${codigo} onInput=${(e) => setCodigo(e.currentTarget.value)} />
        <//>
        <${Notice} tipo="error">${aviso}<//>
        <${Button} type="submit">Guardar<//>
      </form>
    <//>
  `;
}
