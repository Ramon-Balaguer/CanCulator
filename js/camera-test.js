// Página de diagnóstico: comprueba en el móvil que la cámara abre y que ZXing lee un código real.
import { html, render } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isValidGtin, normalizeCode, codeType } from './logica/barcode.js';
import { PHOTO_NO_CODE_MESSAGE, cameraErrorMessage, CAMERA_CONSTRAINTS } from './logica/camera.js';

const { BrowserMultiFormatOneDReader, BarcodeFormat } = window.ZXingBrowser;

const STATUS_TEXT = {
  parada: 'Cámara parada',
  abriendo: 'Abriendo cámara…',
  leyendo: 'Buscando código…',
};

function newReading(result, origin) {
  const text = normalizeCode(result.getText());
  return {
    texto: text,
    formato: BarcodeFormat[result.getBarcodeFormat()] ?? 'desconocido',
    tipo: codeType(text),
    valido: isValidGtin(text),
    origen: origin,
  };
}

function Diagnostics() {
  const rows = [
    ['Contexto seguro (HTTPS)', window.isSecureContext],
    ['Acceso a cámara (mediaDevices)', !!navigator.mediaDevices?.getUserMedia],
    ['Instalada en pantalla de inicio', matchMedia('(display-mode: standalone)').matches || navigator.standalone === true],
    ['Lector nativo (BarcodeDetector)', 'BarcodeDetector' in window],
  ];
  return html`
    <section class="tarjeta">
      <h2>Este dispositivo</h2>
      <dl class="diagnostico">
        ${rows.map(([name, value]) => html`
          <dt>${name}</dt><dd data-ok=${value ? 'si' : 'no'}>${value ? 'sí' : 'no'}</dd>
        `)}
      </dl>
      <p class="nota">${navigator.userAgent}</p>
    </section>
  `;
}

function Result({ lectura }) {
  if (!lectura) return null;
  const check = lectura.valido ? 'dígito de control correcto' : 'dígito de control incorrecto';
  return html`
    <section class="tarjeta" aria-live="polite">
      <h2>Código leído</h2>
      <p class="codigo" data-testid="codigo-leido">${lectura.texto}</p>
      <p data-testid="codigo-detalle">${lectura.tipo ?? lectura.formato} · ${check} · desde ${lectura.origen}</p>
    </section>
  `;
}

function CameraTest() {
  const video = useRef(null);
  const controls = useRef(null);
  const reader = useRef(new BrowserMultiFormatOneDReader());
  const [status, setEstado] = useState('parada');
  const [lectura, setLectura] = useState(null);
  const [error, setError] = useState('');

  const stop = () => {
    controls.current?.stop();
    controls.current = null;
    setEstado('parada');
  };

  useEffect(() => stop, []);

  async function open() {
    setError('');
    setLectura(null);
    setEstado('abriendo');
    try {
      controls.current = await reader.current.decodeFromConstraints(CAMERA_CONSTRAINTS, video.current, (result) => {
        if (!result) return;
        setLectura(newReading(result, 'cámara'));
        navigator.vibrate?.(80);
        stop();
      });
      // Si ya se leyó un código mientras arrancaba, no volver a "leyendo".
      if (controls.current) setEstado('leyendo');
    } catch (e) {
      setError(cameraErrorMessage(e));
      stop();
    }
  }

  async function readPhoto(event) {
    const entry = event.currentTarget;
    const uploadedFile = entry.files?.[0];
    entry.value = '';
    if (!uploadedFile) return;
    setError('');
    setLectura(null);
    const url = URL.createObjectURL(uploadedFile);
    try {
      setLectura(newReading(await reader.current.decodeFromImageUrl(url), 'foto'));
    } catch {
      setError(PHOTO_NO_CODE_MESSAGE);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return html`
    <p>Apunta a un código de barras de una lata o paquete. Si la cámara en vivo falla, prueba con una foto.</p>
    <div class="acciones">
      ${status === 'parada'
        ? html`<button type="button" class="boton" onClick=${open}>Abrir cámara</button>`
        : html`<button type="button" class="boton secundario" onClick=${stop}>Parar cámara</button>`}
      <label class="boton secundario">
        Leer de una foto
        <input type="file" accept="image/*" capture="environment" class="oculto" data-testid="foto" onChange=${readPhoto} />
      </label>
    </div>
    <p class="estado" data-testid="estado-camara">${STATUS_TEXT[status]}</p>
    <video ref=${video} class="visor" hidden=${status === 'parada'} playsinline muted autoplay></video>
    ${error && html`<p class="error" role="alert">${error}</p>`}
    <${Result} lectura=${lectura} />
    <${Diagnostics} />
  `;
}

render(html`<${CameraTest} />`, document.getElementById('contenido'));
