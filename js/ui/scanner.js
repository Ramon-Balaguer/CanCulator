import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field, Modal, Notice } from './components.js';
import { isValidGtin } from '../logica/barcode.js';
import { caducidadDesdeDigitalLink, codigoDesdeTexto } from '../logica/gs1-digital-link.js';
import { cameraErrorMessage, CAMERA_CONSTRAINTS, photoNoCodeMessage } from '../logica/camera.js';
import { decodeInvite } from '../logica/peer-sync.js';
import { t } from '../logica/idioma.js';

// Scanner with the camera and, always, manual code entry as a backup.
// The camera reads barcodes and the GS1 Digital Link QR codes that some products carry now.
export function ScannerModal({ onCodigo, onCerrar }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [notice, setAviso] = useState('');

  useEffect(() => {
    let controls = null;
    let closed = false;
    const reader = window.ZXingBrowser?.BrowserMultiFormatReader;
    if (!reader) {
      setError(t('escaner.no_disponible'));
      return undefined;
    }
    new reader().decodeFromConstraints(CAMERA_CONSTRAINTS, video.current, (result) => {
      if (!result || closed) return;
      closed = true;
      navigator.vibrate?.(80);
      const texto = result.getText();
      onCodigo(codigoDesdeTexto(texto), caducidadDesdeDigitalLink(texto));
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
    const code = codigoDesdeTexto(manual);
    if (!code) return;
    if (!/^\d{8,14}$/.test(code)) {
      setAviso(t('escaner.digitos'));
      return;
    }
    if (!isValidGtin(code)) {
      setAviso(t('escaner.digito_control'));
      return;
    }
    onCodigo(code, caducidadDesdeDigitalLink(manual));
  }

  return html`
    <${Modal} titulo=${t('escaner.titulo')} onCerrar=${onCerrar}>
      <video ref=${video} class="visor" playsinline muted autoplay></video>
      <${Notice} tipo="error">${error}<//>
      <form class="formulario" onSubmit=${sendManual}>
        <${Field} etiqueta=${t('escaner.manual')}>
          <input inputmode="numeric" autocomplete="off" value=${manual} onInput=${(e) => setManual(e.currentTarget.value)} />
        <//>
        <${Notice} tipo="error">${notice}<//>
        <${Button} type="submit">${t('btn.usar_codigo')}<//>
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
      setAviso(t('qr.no_sala'));
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
      setError(t('qr.no_disponible'));
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
      setAviso(photoNoCodeMessage());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function guardar(event) {
    event.preventDefault();
    const pass = password.trim();
    const code = codigo.trim().toUpperCase();
    if (!pass) return setAviso(t('qr.pass_vacia'));
    if (code.length !== 6) return setAviso(t('qr.codigo_largo'));
    onGuardar({ codigo: code, password: pass });
  }

  return html`
    <${Modal} titulo=${t('qr.titulo')} onCerrar=${onCerrar}>
      <video ref=${video} class="visor" playsinline muted autoplay></video>
      <${Notice} tipo="error">${error}<//>
      <form class="formulario" onSubmit=${guardar}>
        <label class="boton secundario">
          ${t('btn.hacer_foto_qr')}
          <input type="file" accept="image/*" capture="environment" class="oculto" onChange=${leerFoto} />
        </label>
        <${Field} etiqueta=${t('sincronizar.password')}>
          <input type="password" autocomplete="off" value=${password} onInput=${(e) => setPassword(e.currentTarget.value)} />
        <//>
        <${Field} etiqueta=${t('qr.codigo')}>
          <input autocomplete="off" maxlength="6" value=${codigo} onInput=${(e) => setCodigo(e.currentTarget.value)} />
        <//>
        <${Notice} tipo="error">${aviso}<//>
        <${Button} type="submit">${t('btn.guardar')}<//>
      </form>
    <//>
  `;
}
