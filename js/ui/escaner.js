import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Boton, Campo, Modal, Aviso } from './componentes.js';
import { esGtinValido, normalizarCodigo } from '../logica/codigo-barras.js';
import { mensajeErrorCamara, RESTRICCIONES_CAMARA } from '../logica/camara.js';

// Escáner con cámara y, siempre, entrada manual del código como respaldo.
export function ModalEscaner({ onCodigo, onCerrar }) {
  const video = useRef(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    let controles = null;
    let cerrado = false;
    const lector = window.ZXingBrowser?.BrowserMultiFormatOneDReader;
    if (!lector) {
      setError('El lector de códigos no está disponible. Escribe el código a mano.');
      return undefined;
    }
    new lector().decodeFromConstraints(RESTRICCIONES_CAMARA, video.current, (resultado) => {
      if (!resultado || cerrado) return;
      cerrado = true;
      navigator.vibrate?.(80);
      onCodigo(normalizarCodigo(resultado.getText()));
    })
      .then((c) => {
        controles = c;
        if (cerrado) c.stop();
      })
      .catch((e) => setError(mensajeErrorCamara(e)));
    return () => {
      cerrado = true;
      controles?.stop();
    };
  }, []);

  function enviarManual(evento) {
    evento.preventDefault();
    const codigo = normalizarCodigo(manual);
    if (!codigo) return;
    if (!/^\d{8,14}$/.test(codigo)) {
      setAviso('Un código de barras tiene entre 8 y 14 dígitos.');
      return;
    }
    if (!esGtinValido(codigo)) {
      setAviso('Ese código no tiene un dígito de control correcto. Revísalo.');
      return;
    }
    onCodigo(codigo);
  }

  return html`
    <${Modal} titulo="Escanear código" onCerrar=${onCerrar}>
      <video ref=${video} class="visor" playsinline muted autoplay></video>
      <${Aviso} tipo="error">${error}<//>
      <form class="formulario" onSubmit=${enviarManual}>
        <${Campo} etiqueta="O escribe el código">
          <input inputmode="numeric" autocomplete="off" value=${manual} onInput=${(e) => setManual(e.currentTarget.value)} />
        <//>
        <${Aviso} tipo="error">${aviso}<//>
        <${Boton}>Usar este código<//>
      </form>
    <//>
  `;
}
