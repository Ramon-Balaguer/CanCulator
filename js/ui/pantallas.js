import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Aviso, Boton, Campo, Vacio } from './componentes.js';
import { Miniatura } from './miniatura.js';
import { CodigoBarras } from './codigo-barras.js';
import { consumir, guardarConfiguracion, guardarMeta } from '../datos/tienda.js';
import { descargarTexto, exportarCopia, importarCopia } from '../datos/copia-io.js';
import { VERSION } from '../version.js';
import { validarValor } from '../logica/configuracion.js';
import { describirCaducidad, diasEntre, formatearFecha, hoyEnMadrid } from '../logica/fechas.js';
import { estadoCaducidad, filtrarResumen, idCorto, lotesVisibles, mapaPorId, aReponer, resumenStock } from '../logica/inventario.js';
import { estadisticasStock } from '../logica/estadisticas.js';

// ---------- Caducidad ----------
export function PantallaCaducidad({ db, dispositivo, datos, config, notificar, refrescar, onEditarLote }) {
  const hoy = hoyEnMadrid();
  const porId = mapaPorId(datos.productos);
  const lotes = lotesVisibles(datos.lotes, datos.productos);
  if (lotes.length === 0) return html`<section class="pantalla"><h2>Caducidad</h2><${Vacio}>No hay comida registrada. Usa el botón + para añadir un lote.<//></section>`;

  async function consumirLote(lote, n) {
    try {
      await consumir(db, dispositivo, lote.id, n);
      notificar(`Consumido: ${n} de ${porId.get(lote.producto_id).nombre}`, 'ok');
      refrescar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  }

  return html`
    <section class="pantalla">
      <h2>Caducidad</h2>
      <ul class="lista">
        ${lotes.map((lote) => {
          const producto = porId.get(lote.producto_id);
          const estado = estadoCaducidad(lote.caducidad, hoy, config.dias_caduca_pronto);
          const dias = diasEntre(hoy, lote.caducidad);
          return html`
            <li class=${`tarjeta estado-${estado}`}>
              <${Miniatura} db=${db} fotoId=${lote.foto_id} />
              <div class="tarjeta-cuerpo">
                <strong>${producto.nombre}</strong>
                <span class="secundario">${lote.ubicacion} · ${lote.cantidad} ud.</span>
                <span class="etiqueta-estado">${formatearFecha(lote.caducidad)} · ${describirCaducidad(dias)}</span>
              </div>
              <div class="tarjeta-acciones">
                <${Boton} onClick=${() => consumirLote(lote, 1)}>−1<//>
                <${Boton} tipo="secundario" onClick=${() => onEditarLote(lote)}>Editar<//>
              </div>
            </li>`;
        })}
      </ul>
    </section>
  `;
}

// ---------- Stock ----------
// Resumen del stock: unidades y calorías, en total y por categoría. Ignora los filtros de abajo.
function Estadisticas({ datos }) {
  const e = estadisticasStock(datos.productos, datos.lotes, datos.cacheOff ?? []);
  if (e.totalUnidades === 0) return null;
  return html`
    <div class="estadisticas bloque" data-testid="estadisticas">
      <h3>Estadísticas</h3>
      <p>Unidades en total: <strong data-testid="unidades-total">${e.totalUnidades}</strong></p>
      <p>Calorías en total: <strong data-testid="kcal-total">${e.totalKcal} kcal</strong>
        ${e.productosSinKcal > 0 && html`<span class="secundario"> (faltan datos de ${e.productosSinKcal} ${e.productosSinKcal === 1 ? 'producto' : 'productos'})</span>`}
      </p>
      <table class="tabla-estadisticas">
        <thead><tr><th>Categoría</th><th>Unidades</th><th>Kcal</th></tr></thead>
        <tbody>
          ${e.porCategoria.map((c) => html`
            <tr>
              <td>${c.categoria}</td>
              <td>${c.unidades}</td>
              <td>${c.productosSinKcal > 0 && c.kcal === 0 ? '—' : `${c.kcal}`}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}

export function PantallaStock({ datos, config, onAbrirProducto }) {
  const [categoria, setCategoria] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const hoy = hoyEnMadrid();
  const resumen = filtrarResumen(resumenStock(datos.productos, datos.lotes), { categoria, ubicacion });
  const categoriasUsadas = [...new Set(datos.productos.filter((p) => !p.borrado).map((p) => p.categoria))];
  return html`
    <section class="pantalla">
      <h2>Stock</h2>
      <${Estadisticas} datos=${datos} />

      <div class="fila">
        <${Campo} etiqueta="Categoría">
          <select value=${categoria} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            <option value="">Todas</option>
            ${[...new Set([...config.categorias, ...categoriasUsadas])].map((c) => html`<option value=${c} selected=${c === categoria}>${c}</option>`)}
          </select>
        <//>
        <${Campo} etiqueta="Ubicación">
          <select value=${ubicacion} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            <option value="">Todas</option>
            ${config.ubicaciones.map((u) => html`<option value=${u} selected=${u === ubicacion}>${u}</option>`)}
          </select>
        <//>
      </div>
      ${resumen.length === 0 && html`<${Vacio}>Ningún producto con estos filtros.<//>`}
      <ul class="lista">
        ${resumen.map((fila) => html`
          <li>
            <button type="button" class="fila-boton" onClick=${() => onAbrirProducto(fila.producto)}>
              <span class="fila-titulo">${fila.producto.nombre}</span>
              <span class="secundario">${fila.producto.categoria}</span>
              <span class="fila-dato">${fila.total} ud.${fila.proximaCaducidad
                ? html` · ${formatearFecha(fila.proximaCaducidad)} (${describirCaducidad(diasEntre(hoy, fila.proximaCaducidad))})`
                : ' · agotado'}</span>
            </button>
          </li>`)}
      </ul>
    </section>
  `;
}

// ---------- A reponer ----------
export function PantallaReponer({ datos, onComprado }) {
  const pendientes = aReponer(datos.productos, datos.lotes);
  if (pendientes.length === 0) {
    return html`<section class="pantalla"><h2>A reponer</h2><${Vacio}>Nada por debajo del mínimo.<//></section>`;
  }
  return html`
    <section class="pantalla">
      <h2>A reponer</h2>
      <ul class="lista">
        ${pendientes.map((fila) => html`
          <li class="tarjeta">
            <div class="tarjeta-cuerpo">
              <strong>${fila.producto.nombre}</strong>
              <span class="secundario">Hay ${fila.stock} de ${fila.producto.stock_minimo} · faltan ${fila.falta}</span>
            </div>
            <div class="tarjeta-acciones">
              <${Boton} onClick=${() => onComprado(fila.producto)}>Comprado<//>
            </div>
          </li>`)}
      </ul>
    </section>
  `;
}

// ---------- Imprimir ----------
export function PantallaImprimir({ db, datos }) {
  const porId = mapaPorId(datos.productos);
  const lotes = lotesVisibles(datos.lotes, datos.productos);
  return html`
    <section class="pantalla">
      <div class="no-imprimir acciones">
        <h2>Imprimir</h2>
        <${Boton} onClick=${() => window.print()}>Imprimir<//>
      </div>
      <p class="solo-imprimir cabecera-impresion">Inventario de casa · ${formatearFecha(hoyEnMadrid())}</p>
      <table class="tabla-imprimir">
        <thead>
          <tr><th>Foto</th><th>ID</th><th>Producto</th><th>Código</th><th>Ubicación</th><th>Caducidad</th><th>Cant.</th><th>Consumido</th></tr>
        </thead>
        <tbody>
          ${lotes.map((lote) => html`
            <tr>
              <td class="celda-foto"><${Miniatura} db=${db} fotoId=${lote.foto_id} /></td>
              <td>${idCorto(lote.id)}</td>
              <td>${porId.get(lote.producto_id).nombre}</td>
              <td class="celda-codigo"><${CodigoBarras} codigo=${porId.get(lote.producto_id).codigo_barras} /></td>
              <td>${lote.ubicacion}</td>
              <td>${formatearFecha(lote.caducidad)}</td>
              <td>${lote.cantidad}</td>
              <td class="celda-vacia"></td>
            </tr>`)}
        </tbody>
      </table>
    </section>
  `;
}

// ---------- Ajustes ----------
function ListaEditable({ titulo, valores, onGuardar, notificar }) {
  const [nuevo, setNuevo] = useState('');
  // Quitar una categoría o ubicación pide confirmación.
  const quitar = (valor) => {
    if (!window.confirm(`¿Quitar «${valor}»?`)) return;
    const anteriores = valores;
    onGuardar(valores.filter((v) => v !== valor))
      .then(() => notificar(`Quitada «${valor}».`, 'info', { etiqueta: 'Deshacer', onClick: () => onGuardar(anteriores) }))
      .catch((e) => notificar(e.message, 'error'));
  };
  const añadir = (evento) => {
    evento.preventDefault();
    const texto = nuevo.trim();
    if (!texto) return;
    onGuardar([...valores, texto])
      .then(() => setNuevo(''))
      .catch((e) => notificar(e.message, 'error'));
  };
  return html`
    <div class="bloque">
      <h3>${titulo}</h3>
      <ul class="chips">
        ${valores.map((v) => html`<li class="chip">${v}<button type="button" aria-label=${`Quitar ${v}`} onClick=${() => quitar(v)}>✕</button></li>`)}
      </ul>
      <form class="fila" onSubmit=${añadir}>
        <input value=${nuevo} onInput=${(e) => setNuevo(e.currentTarget.value)} aria-label=${`Nueva ${titulo.toLowerCase()}`} />
        <${Boton} tipo="secundario" type="submit">Añadir<//>
      </form>
    </div>`;
}

export function PantallaAjustes({ db, dispositivo, config, notificar, refrescar, sincronizacion, estadoSync, ultimaSync, pendientes, onGuardarSincro, onSincronizar }) {
  const [sincro, setSincro] = useState(sincronizacion);
  const [importado, setImportado] = useState('');
  const guardar = async (clave, valor) => {
    const limpio = validarValor(clave, valor);
    await guardarConfiguracion(db, clave, limpio);
    refrescar();
    return limpio;
  };

  async function exportar() {
    try {
      descargarTexto(await exportarCopia(db, dispositivo));
      notificar('Copia exportada', 'ok');
    } catch (e) {
      notificar(`No se pudo exportar: ${e.message}`, 'error');
    }
  }

  async function importar(evento) {
    const fichero = evento.currentTarget.files?.[0];
    evento.currentTarget.value = '';
    if (!fichero) return;
    try {
      const r = await importarCopia(db, fichero);
      setImportado(`Importado: ${r.productos} productos y ${r.lotes} lotes nuevos o más recientes, ${r.fotos} fotos.`);
      refrescar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  }

  async function guardarSincro() {
    const nueva = { url: sincro.url.trim(), token: sincro.token.trim() };
    await guardarMeta(db, 'sync_url', nueva.url);
    await guardarMeta(db, 'sync_token', nueva.token);
    notificar('Datos de sincronización guardados', 'ok');
    onGuardarSincro(nueva);
  }

  return html`
    <section class="pantalla">
      <h2>Ajustes</h2>

      <${ListaEditable} titulo="Categorías" valores=${config.categorias}
        onGuardar=${(lista) => guardar('categorias', lista)} notificar=${notificar} />
      <${ListaEditable} titulo="Ubicaciones" valores=${config.ubicaciones}
        onGuardar=${(lista) => guardar('ubicaciones', lista)} notificar=${notificar} />

      <div class="bloque">
        <h3>Avisos</h3>
        <${Campo} etiqueta="Días para «caduca pronto»">
          <input type="number" min="0" max="3650" value=${config.dias_caduca_pronto}
            onChange=${(e) => guardar('dias_caduca_pronto', e.currentTarget.value).catch((err) => notificar(err.message, 'error'))} />
        <//>
        <${Campo} etiqueta="Hora del aviso diario">
          <input type="time" value=${config.hora_aviso}
            onChange=${(e) => guardar('hora_aviso', e.currentTarget.value).catch((err) => notificar(err.message, 'error'))} />
        <//>
        <${Campo} etiqueta="Emails de avisos" ayuda="Uno por línea o separados por comas.">
          <textarea rows="3" onChange=${(e) => guardar('emails_avisos', e.currentTarget.value.split(/[\s,]+/)).catch((err) => notificar(err.message, 'error'))}>${config.emails_avisos.join('\n')}</textarea>
        <//>
      </div>

      <div class="bloque">
        <h3>Sincronización</h3>
        <p class="secundario" data-testid="estado-sync" role="status">${estadoSync.mensaje || 'Sin sincronizar.'}</p>
        <p class="secundario">Operaciones pendientes de enviar: <strong data-testid="pendientes-sync">${pendientes}</strong>.
          ${ultimaSync ? ' Última sincronización: ' + new Date(ultimaSync).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) + '.' : ' Aún no se ha sincronizado.'}</p>
        <${Campo} etiqueta="URL de Apps Script">
          <input type="url" value=${sincro.url} onInput=${(e) => setSincro({ ...sincro, url: e.currentTarget.value })} />
        <//>
        <${Campo} etiqueta="Token">
          <input type="password" autocomplete="off" value=${sincro.token} onInput=${(e) => setSincro({ ...sincro, token: e.currentTarget.value })} />
        <//>
        <div class="acciones">
          <${Boton} tipo="secundario" onClick=${guardarSincro}>Guardar<//>
          <${Boton} disabled=${estadoSync.estado === 'sincronizando'} onClick=${onSincronizar}>Sincronizar ahora<//>
        </div>
      </div>

      <div class="bloque">
        <h3>Versión</h3>
        <p class="secundario">Commit de esta app: <span class="codigo-pequeno" data-testid="version-completa">${VERSION}</span></p>
        <p class="secundario">Compara este texto entre móviles: si coincide, es la misma versión.</p>
      </div>

      <div class="bloque">
        <h3>Diagnóstico</h3>
        <p><a href="prueba-camara.html">Prueba de cámara y código de barras</a></p>
      </div>

      <div class="bloque">
        <h3>Copia de seguridad</h3>
        <div class="acciones">
          <${Boton} onClick=${exportar}>Exportar JSON<//>
          <label class="boton secundario">
            Importar JSON
            <input type="file" accept="application/json,.json" class="oculto" onChange=${importar} />
          </label>
        </div>
        <${Aviso} tipo="ok">${importado}<//>
        <p class="secundario">Importar fusiona la copia con lo que ya hay: gana el registro más reciente.</p>
      </div>
    </section>
  `;
}
