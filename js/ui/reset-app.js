import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Button, Notice } from './components.js';
import { exportBackup, downloadText, resetDatabase } from '../datos/backup-io.js';
import { preguntaDeSuma, esRespuestaCorrecta } from '../logica/reinicio.js';
import { t } from '../logica/idioma.js';

// Resets the whole app. The backup is downloaded first; if it fails, nothing is deleted.
// A wrong answer asks a new sum, so it cannot be guessed by repeating the same one.
export function ResetApp({ db, dispositivo: device, notificar: notifyUser }) {
  const [pregunta, setPregunta] = useState(null);
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState('');

  async function confirmar(event) {
    event.preventDefault();
    if (!esRespuestaCorrecta(pregunta, respuesta)) {
      setError(t('ajustes.reset_incorrecta'));
      setPregunta(preguntaDeSuma());
      setRespuesta('');
      return;
    }
    try {
      downloadText(await exportBackup(db, device));
      await resetDatabase(db);
      globalThis.location.reload();
    } catch (e) {
      notifyUser(t('ajustes.reset_error', { error: e.message }), 'error');
    }
  }

  return html`
    <div class="bloque">
      <h3>${t('ajustes.reset_titulo')}</h3>
      <p class="secundario">${t('ajustes.reset_aviso')}</p>
      ${pregunta ? html`
        <form class="acciones" onSubmit=${confirmar}>
          <p>${t('ajustes.reset_pregunta', { a: pregunta.a, b: pregunta.b })}</p>
          <input type="text" inputmode="numeric" autocomplete="off" aria-label=${t('ajustes.reset_resultado')}
            value=${respuesta} onInput=${(e) => setRespuesta(e.currentTarget.value)} />
          <${Button} tipo="peligro" type="submit">${t('ajustes.reset_confirmar')}<//>
          <${Button} tipo="secundario" onClick=${() => setPregunta(null)}>${t('btn.cancelar')}<//>
        </form>
      ` : html`
        <${Button} tipo="peligro" onClick=${() => { setError(''); setPregunta(preguntaDeSuma()); }}>${t('ajustes.reset_titulo')}<//>
      `}
      ${error && html`<${Notice} tipo="error">${error}<//>`}
    </div>
  `;
}
