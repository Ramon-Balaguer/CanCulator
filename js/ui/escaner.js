import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Field, Modal, Notice } from './componentes.js';
import { isValidGtin, normalizeCode } from '../logica/codigo-barras.js';
import { cameraErrorMessage, CAMERA_CONSTRAINTS } from '../logica/camara.js';

// Escáner con cámara y, siempre, entrada manual del código como respaldo.
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
