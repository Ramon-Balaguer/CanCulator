// Página de diagnóstico: comprueba en el móvil que la cámara abre y que ZXing lee un código real.
import { html, render } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { esGtinValido, normalizarCodigo, tipoCodigo } from './logica/codigo-barras.js';
import { MENSAJE_FOTO_SIN_CODIGO, mensajeErrorCamara, RESTRICCIONES_CAMARA } from './logica/camara.js';

const { BrowserMultiFormatOneDReader, BarcodeFormat } = window.ZXingBrowser;

const TEXTO_ESTADO = {
  parada: 'Cámara parada',
  abriendo: 'Abriendo cámara…',
  leyendo: 'Buscando código…',
};

function nuevaLectura(resultado, origen) {
  const texto = normalizarCodigo(resultado.getText());
  return {
    texto,
    formato: BarcodeFormat[resultado.getBarcodeFormat()] ?? 'desconocido',
    tipo: tipoCodigo(texto),
    valido: esGtinValido(texto),
    origen,
  };
}

function Diagnostico() {
  const filas = [
    ['Contexto seguro (HTTPS)', window.isSecureContext],
    ['Acceso a cámara (mediaDevices)', !!navigator.mediaDevices?.getUserMedia],
    ['Instalada en pantalla de inicio', matchMedia('(display-mode: standalone)').matches || navigator.standalone === true],
    ['Lector nativo (BarcodeDetector)', 'BarcodeDetector' in window],
  ];
  return html`
    <section class="tarjeta">
      <h2>Este dispositivo</h2>
      <dl class="diagnostico">
        ${filas.map(([nombre, valor]) => html`
          <dt>${nombre}</dt><dd data-ok=${valor ? 'si' : 'no'}>${valor ? 'sí' : 'no'}</dd>
        `)}
      </dl>
      <p class="nota">${navigator.userAgent}</p>
    </section>
  `;
}

function Resultado({ lectura }) {
  if (!lectura) return null;
  const control = lectura.valido ? 'dígito de control correcto' : 'dígito de control incorrecto';
  return html`
    <section class="tarjeta" aria-live="polite">
      <h2>Código leído</h2>
      <p class="codigo" data-testid="codigo-leido">${lectura.texto}</p>
      <p data-testid="codigo-detalle">${lectura.tipo ?? lectura.formato} · ${control} · desde ${lectura.origen}</p>
    </section>
  `;
}

function PruebaCamara() {
  const video = useRef(null);
  const controles = useRef(null);
  const lector = useRef(new BrowserMultiFormatOneDReader());
  const [estado, setEstado] = useState('parada');
  const [lectura, setLectura] = useState(null);
  const [error, setError] = useState('');

  const parar = () => {
    controles.current?.stop();
    controles.current = null;
    setEstado('parada');
  };

  useEffect(() => parar, []);

  async function abrir() {
    setError('');
    setLectura(null);
    setEstado('abriendo');
    try {
      controles.current = await lector.current.decodeFromConstraints(RESTRICCIONES_CAMARA, video.current, (resultado) => {
        if (!resultado) return;
        setLectura(nuevaLectura(resultado, 'cámara'));
        navigator.vibrate?.(80);
        parar();
      });
      // Si ya se leyó un código mientras arrancaba, no volver a "leyendo".
      if (controles.current) setEstado('leyendo');
    } catch (e) {
      setError(mensajeErrorCamara(e));
      parar();
    }
  }

  async function leerFoto(evento) {
    const entrada = evento.currentTarget;
    const fichero = entrada.files?.[0];
    entrada.value = '';
    if (!fichero) return;
    setError('');
    setLectura(null);
    const url = URL.createObjectURL(fichero);
    try {
      setLectura(nuevaLectura(await lector.current.decodeFromImageUrl(url), 'foto'));
    } catch {
      setError(MENSAJE_FOTO_SIN_CODIGO);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return html`
    <p>Apunta a un código de barras de una lata o paquete. Si la cámara en vivo falla, prueba con una foto.</p>
    <div class="acciones">
      ${estado === 'parada'
        ? html`<button type="button" class="boton" onClick=${abrir}>Abrir cámara</button>`
        : html`<button type="button" class="boton secundario" onClick=${parar}>Parar cámara</button>`}
      <label class="boton secundario">
        Leer de una foto
        <input type="file" accept="image/*" capture="environment" class="oculto" data-testid="foto" onChange=${leerFoto} />
      </label>
    </div>
    <p class="estado" data-testid="estado-camara">${TEXTO_ESTADO[estado]}</p>
    <video ref=${video} class="visor" hidden=${estado === 'parada'} playsinline muted autoplay></video>
    ${error && html`<p class="error" role="alert">${error}</p>`}
    <${Resultado} lectura=${lectura} />
    <${Diagnostico} />
  `;
}

render(html`<${PruebaCamara} />`, document.getElementById('contenido'));
