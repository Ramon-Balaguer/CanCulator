import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { Aviso, Boton, Campo, Modal } from './componentes.js';
import { ModalEscaner } from './escaner.js';
import { altaLote, borrarLote, borrarProducto, consumir, crearProducto, editarLote, editarProducto, guardarFoto, reponer } from '../datos/tienda.js';
import { comprimirFoto } from '../datos/fotos.js';
import { buscarProductoPorCodigo, buscarProductoPorNombre, lotesParaConsumir } from '../logica/inventario.js';
import { esGtinValido } from '../logica/codigo-barras.js';
import { hoyEnMadrid, formatearFecha, diasEntre, describirCaducidad } from '../logica/fechas.js';
import { Miniatura } from './miniatura.js';
import { consultarOFF, ESTADOS } from '../datos/off.js';
import { DatosOFF } from './datos-off.js';

const CAMPOS_VACIOS = () => ({
  codigo: '',
  nombre: '',
  categoria: '',
  ubicacion: '',
  caducidad: '',
  cantidad: '1',
  observaciones: '',
  foto: null,
});

// Alta de un lote. Si llega productoInicial (desde A reponer), va preseleccionado.
export function AltaLote({ db, dispositivo, datos, config, productoInicial, onHecho, onCancelar, notificar }) {
  const [campos, setCampos] = useState(() => {
    const inicio = CAMPOS_VACIOS();
    if (productoInicial) {
      inicio.nombre = productoInicial.nombre;
      inicio.categoria = productoInicial.categoria;
      inicio.codigo = productoInicial.codigo_barras ?? '';
    }
    inicio.ubicacion = config.ubicaciones[0] ?? '';
    inicio.categoria = inicio.categoria || (config.categorias[0] ?? '');
    return inicio;
  });
  const [escaneando, setEscaneando] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [consultando, setConsultando] = useState(false);
  const [ofProducto, setOfProducto] = useState(null);
  const [verOFF, setVerOFF] = useState(false);

  const cambiar = (clave) => (evento) => setCampos({ ...campos, [clave]: evento.currentTarget.value });

  useEffect(() => {
    if (!campos.foto) { setPrevia(null); return undefined; }
    const url = URL.createObjectURL(campos.foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [campos.foto]);

  // Tras escanear: si ya hay un producto, se usa; si no, se pregunta a Open Food Facts UNA vez.
  // Un fallo nunca bloquea el alta: el nombre queda editable a mano.
  async function alEscanear(codigo) {
    setEscaneando(false);
    setAviso(null);
    const existente = buscarProductoPorCodigo(datos.productos, codigo);
    setCampos((c) => ({
      ...c,
      codigo,
      nombre: existente?.nombre ?? c.nombre,
      categoria: existente?.categoria ?? c.categoria,
    }));
    if (existente) {
      setAviso({ tipo: 'info', texto: `Ya tienes «${existente.nombre}». Revisa los datos del lote.` });
      return;
    }
    if (!esGtinValido(codigo)) {
      setAviso({ tipo: 'error', texto: 'El código no tiene un dígito de control válido. Escribe el nombre a mano.' });
      return;
    }
    setConsultando(true);
    try {
      const r = await consultarOFF(db, codigo);
      if (r.estado === ESTADOS.ENCONTRADO) {
        setOfProducto(r.producto ?? null);
        setCampos((c) => ({ ...c, nombre: c.nombre.trim() ? c.nombre : r.nombre }));
        const marca = r.marca && r.marca !== r.nombre ? ` (${r.marca})` : '';
        setAviso({ tipo: 'info', texto: `Open Food Facts: ${r.nombre}${marca}. Revisa el nombre antes de guardar.` });
      } else if (r.estado === ESTADOS.NO_ENCONTRADO) {
        setAviso({ tipo: 'info', texto: 'No está en Open Food Facts. Escribe el nombre a mano.' });
      } else if (r.estado === ESTADOS.SIN_CONEXION) {
        setAviso({ tipo: 'info', texto: 'Sin conexión: escribe el nombre a mano.' });
      } else {
        setAviso({ tipo: 'error', texto: 'No se pudo consultar Open Food Facts. Escribe el nombre a mano.' });
      }
    } finally {
      setConsultando(false);
    }
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    const nombre = campos.nombre.trim();
    if (!nombre) return setError('Escribe el nombre del producto');
    if (!campos.categoria) return setError('Elige una categoría');
    if (!campos.ubicacion) return setError('Elige una ubicación');
    if (!campos.caducidad) return setError('Indica la fecha de caducidad');
    const cantidad = Number(campos.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1) return setError('La cantidad debe ser un número entero de 1 o más');

    setGuardando(true);
    try {
      const existente = productoInicial
        ?? buscarProductoPorCodigo(datos.productos, campos.codigo)
        ?? buscarProductoPorNombre(datos.productos, nombre);
      const producto = existente ?? await crearProducto(db, dispositivo, {
        nombre,
        categoria: campos.categoria,
        codigo_barras: campos.codigo,
        stock_minimo: 0,
      });
      let foto_id = '';
      let avisoFoto = '';
      if (campos.foto) {
        try {
          foto_id = await guardarFoto(db, await comprimirFoto(campos.foto));
        } catch (e) {
          avisoFoto = ` La foto no se guardó: ${e.message}`;
        }
      }
      await altaLote(db, dispositivo, {
        producto_id: producto.id,
        cantidad,
        caducidad: campos.caducidad,
        ubicacion: campos.ubicacion,
        observaciones: campos.observaciones,
        foto_id,
      });
      notificar(`Añadido: ${producto.nombre}.${avisoFoto}`, avisoFoto ? 'error' : 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const categorias = [...new Set([...config.categorias, campos.categoria].filter(Boolean))];
  const ubicaciones = [...new Set([...config.ubicaciones, campos.ubicacion].filter(Boolean))];

  return html`
    <section class="pantalla">
      <h2>Añadir lote</h2>
      <form class="formulario" onSubmit=${guardar}>
        <div class="fila">
          <${Boton} tipo="secundario" onClick=${() => setEscaneando(true)}>Escanear código<//>
          ${campos.codigo && html`<span class="codigo-pequeno">${campos.codigo}</span>`}
        </div>
        ${escaneando && html`<${ModalEscaner} onCodigo=${alEscanear} onCerrar=${() => setEscaneando(false)} />`}
        ${consultando && html`<p class="secundario">Consultando Open Food Facts…</p>`}
        <${Aviso} tipo=${aviso?.tipo ?? 'info'}>${aviso?.texto}<//>
        ${ofProducto && html`<${Boton} tipo="secundario" onClick=${() => setVerOFF(true)}>Ver todos los datos de Open Food Facts<//>`}
        ${verOFF && ofProducto && html`<${DatosOFF} codigo=${campos.codigo} producto=${ofProducto} onCerrar=${() => setVerOFF(false)} />`}

        <${Campo} etiqueta="Producto">
          <input required list="productos-existentes" value=${campos.nombre} onInput=${cambiar('nombre')} autocomplete="off" />
          <datalist id="productos-existentes">
            ${datos.productos.filter((p) => !p.borrado).map((p) => html`<option value=${p.nombre}></option>`)}
          </datalist>
        <//>

        <${Campo} etiqueta="Categoría">
          <select value=${campos.categoria} onChange=${cambiar('categoria')}>
            ${categorias.map((c) => html`<option value=${c} selected=${c === campos.categoria}>${c}</option>`)}
          </select>
        <//>

        <${Campo} etiqueta="Ubicación">
          <select value=${campos.ubicacion} onChange=${cambiar('ubicacion')}>
            ${ubicaciones.map((u) => html`<option value=${u} selected=${u === campos.ubicacion}>${u}</option>`)}
          </select>
        <//>

        <div class="fila">
          <${Campo} etiqueta="Caducidad">
            <input type="date" required value=${campos.caducidad} onInput=${cambiar('caducidad')} />
          <//>
          <${Campo} etiqueta="Unidades">
            <input type="number" inputmode="numeric" min="1" step="1" value=${campos.cantidad} onInput=${cambiar('cantidad')} />
          <//>
        </div>

        <${Campo} etiqueta="Observaciones">
          <input value=${campos.observaciones} onInput=${cambiar('observaciones')} maxlength="200" />
        <//>

        <${Campo} etiqueta="Foto del lote (opcional)">
          <input type="file" accept="image/*" capture="environment"
            onChange=${(e) => setCampos({ ...campos, foto: e.currentTarget.files?.[0] ?? null })} />
        <//>
        ${previa && html`<img class="previa" src=${previa} alt="Foto del lote" />`}

        <${Aviso} tipo="error">${error}<//>
        <div class="acciones">
          <${Boton} type="submit" disabled=${guardando}>${guardando ? 'Guardando…' : 'Guardar lote'}<//>
          <${Boton} tipo="secundario" onClick=${onCancelar}>Cancelar<//>
        </div>
      </form>
    <//>
  `;
}

// Detalle de un producto: sus lotes (el que caduca antes primero), consumir, editar y borrar.
export function DetalleProducto({ db, dispositivo, datos, config, producto, onCerrar, onAnadirLote, onEditarLote, notificar, refrescar }) {
  const [cantidades, setCantidades] = useState({});
  const [editando, setEditando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [datosOFF, setDatosOFF] = useState(null);
  const [buscandoOFF, setBuscandoOFF] = useState(false);
  const lotes = lotesParaConsumir(producto.id, datos.lotes);
  const hoy = hoyEnMadrid();

  const cantidadDe = (id) => Math.max(1, Number(cantidades[id] ?? 1) || 1);

  async function consumirDe(lote) {
    const n = cantidadDe(lote.id);
    try {
      await consumir(db, dispositivo, lote.id, n);
      notificar(`Consumido: ${n} de ${producto.nombre}`, 'ok');
      refrescar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  }

  async function reponerEn(lote) {
    const n = cantidadDe(lote.id);
    try {
      await reponer(db, dispositivo, lote.id, n);
      refrescar();
    } catch (e) {
      notificar(e.message, 'error');
    }
  }

  // Lee los datos de la caché (o de la red si no están). Sin conexión y sin caché, avisa.
  async function verDatosOFF() {
    setBuscandoOFF(true);
    try {
      const r = await consultarOFF(db, producto.codigo_barras);
      if (r.estado === ESTADOS.ENCONTRADO && r.producto) setDatosOFF(r.producto);
      else if (r.estado === ESTADOS.NO_ENCONTRADO) notificar('Open Food Facts no tiene este producto.', 'info');
      else if (r.estado === ESTADOS.SIN_CONEXION) notificar('Sin conexión y sin datos guardados de este producto.', 'error');
      else notificar('No se pudo consultar Open Food Facts.', 'error');
    } finally {
      setBuscandoOFF(false);
    }
  }

  async function borrarTodo() {
    await borrarProducto(db, dispositivo, producto.id);
    notificar(`Borrado: ${producto.nombre}`, 'ok');
    onCerrar();
    refrescar();
  }

  if (editando) {
    return html`<${Modal} titulo="Editar producto" onCerrar=${() => setEditando(false)}>
      <${EditarProducto} db=${db} dispositivo=${dispositivo} config=${config} producto=${producto}
        notificar=${notificar} onHecho=${() => { setEditando(false); refrescar(); }} onCancelar=${() => setEditando(false)} />
    <//>`;
  }

  return html`
    <${Modal} titulo=${producto.nombre} onCerrar=${onCerrar}>
      <p class="secundario">${producto.categoria} · mínimo ${producto.stock_minimo}</p>
      ${lotes.length === 0 && html`<p class="vacio">No quedan unidades de este producto.</p>`}
      <ul class="lista-lotes">
        ${lotes.map((lote) => html`
          <li class="lote-fila">
            <${Miniatura} db=${db} fotoId=${lote.foto_id} />
            <div class="lote-datos">
              <strong>${formatearFecha(lote.caducidad)}</strong>
              <span class="secundario">${describirCaducidad(diasEntre(hoy, lote.caducidad))} · ${lote.ubicacion} · ${lote.cantidad} ud.</span>
            </div>
            <div class="lote-acciones">
              <input type="number" min="1" max=${lote.cantidad} aria-label="Unidades"
                value=${cantidades[lote.id] ?? 1}
                onInput=${(e) => setCantidades({ ...cantidades, [lote.id]: e.currentTarget.value })} />
              <${Boton} onClick=${() => consumirDe(lote)}>Consumir<//>
              <${Boton} tipo="secundario" onClick=${() => reponerEn(lote)}>Añadir<//>
              <${Boton} tipo="secundario" onClick=${() => onEditarLote(lote)}>Editar<//>
            </div>
          </li>
        `)}
      </ul>
      <div class="acciones">
        <${Boton} onClick=${() => onAnadirLote(producto)}>Añadir lote<//>
        <${Boton} tipo="secundario" onClick=${() => setEditando(true)}>Editar producto<//>
        ${producto.codigo_barras && html`<${Boton} tipo="secundario" disabled=${buscandoOFF} onClick=${verDatosOFF}>${buscandoOFF ? 'Buscando…' : 'Datos de Open Food Facts'}<//>`}
      </div>
      ${datosOFF && html`<${DatosOFF} codigo=${producto.codigo_barras} producto=${datosOFF} onCerrar=${() => setDatosOFF(null)} />`}
      <div class="zona-peligro">
        ${!confirmarBorrado
          ? html`<${Boton} tipo="peligro" onClick=${() => setConfirmarBorrado(true)}>Borrar producto<//>`
          : html`
            <p>Se borrará el producto y todos sus lotes. ¿Seguro?</p>
            <div class="acciones">
              <${Boton} tipo="peligro" onClick=${borrarTodo}>Sí, borrar<//>
              <${Boton} tipo="secundario" onClick=${() => setConfirmarBorrado(false)}>No<//>
            </div>`}
      </div>
    <//>
  `;
}

export function EditarProducto({ db, dispositivo, config, producto, notificar, onHecho, onCancelar }) {
  const [nombre, setNombre] = useState(producto.nombre);
  const [categoria, setCategoria] = useState(producto.categoria);
  const [codigo, setCodigo] = useState(producto.codigo_barras ?? '');
  const [minimo, setMinimo] = useState(String(producto.stock_minimo));
  const [error, setError] = useState('');
  const categorias = [...new Set([...config.categorias, categoria])];

  async function guardar(evento) {
    evento.preventDefault();
    try {
      await editarProducto(db, dispositivo, producto.id, {
        nombre, categoria, codigo_barras: codigo, stock_minimo: Number(minimo),
      });
      notificar('Producto guardado', 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  return html`
    <section class="pantalla">
      <h2>Editar producto</h2>
      <form class="formulario" onSubmit=${guardar}>
        <${Campo} etiqueta="Nombre"><input required value=${nombre} onInput=${(e) => setNombre(e.currentTarget.value)} /><//>
        <${Campo} etiqueta="Categoría">
          <select value=${categoria} onChange=${(e) => setCategoria(e.currentTarget.value)}>
            ${categorias.map((c) => html`<option value=${c} selected=${c === categoria}>${c}</option>`)}
          </select>
        <//>
        <${Campo} etiqueta="Código de barras"><input inputmode="numeric" value=${codigo} onInput=${(e) => setCodigo(e.currentTarget.value)} /><//>
        <${Campo} etiqueta="Stock mínimo" ayuda="Unidades por debajo de las que avisar en A reponer. 0 = no avisar.">
          <input type="number" min="0" step="1" value=${minimo} onInput=${(e) => setMinimo(e.currentTarget.value)} />
        <//>
        <${Aviso} tipo="error">${error}<//>
        <div class="acciones">
          <${Boton} type="submit">Guardar<//>
          <${Boton} tipo="secundario" onClick=${onCancelar}>Cancelar<//>
        </div>
      </form>
    </section>
  `;
}

export function EditarLote({ db, dispositivo, lote, producto, config, notificar, onHecho, onCerrar }) {
  const [caducidad, setCaducidad] = useState(lote.caducidad);
  const [ubicacion, setUbicacion] = useState(lote.ubicacion);
  const [observaciones, setObservaciones] = useState(lote.observaciones ?? '');
  const [ajuste, setAjuste] = useState('0');
  const [error, setError] = useState('');
  const ubicaciones = [...new Set([...config.ubicaciones, lote.ubicacion])];

  async function guardar(evento) {
    evento.preventDefault();
    setError('');
    try {
      const delta = Number(ajuste);
      if (!Number.isInteger(delta)) throw new Error('El ajuste debe ser un número entero');
      await editarLote(db, dispositivo, lote.id, { caducidad, ubicacion, observaciones });
      if (delta !== 0) {
        await (delta > 0 ? reponer : consumir)(db, dispositivo, lote.id, Math.abs(delta));
      }
      notificar('Lote guardado', 'ok');
      onHecho();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar() {
    await borrarLote(db, dispositivo, lote.id);
    notificar('Lote borrado', 'ok');
    onHecho();
  }

  return html`
    <${Modal} titulo=${`Editar lote de ${producto.nombre}`} onCerrar=${onCerrar}>
      <form class="formulario" onSubmit=${guardar}>
        <${Campo} etiqueta="Caducidad"><input type="date" required value=${caducidad} onInput=${(e) => setCaducidad(e.currentTarget.value)} /><//>
        <${Campo} etiqueta="Ubicación">
          <select value=${ubicacion} onChange=${(e) => setUbicacion(e.currentTarget.value)}>
            ${ubicaciones.map((u) => html`<option value=${u} selected=${u === ubicacion}>${u}</option>`)}
          </select>
        <//>
        <${Campo} etiqueta="Observaciones"><input value=${observaciones} maxlength="200" onInput=${(e) => setObservaciones(e.currentTarget.value)} /><//>
        <${Campo} etiqueta=${`Ajustar unidades (ahora hay ${lote.cantidad})`} ayuda="Positivo para añadir, negativo para quitar.">
          <input type="number" step="1" value=${ajuste} onInput=${(e) => setAjuste(e.currentTarget.value)} />
        <//>
        <${Aviso} tipo="error">${error}<//>
        <div class="acciones">
          <${Boton} type="submit">Guardar<//>
          <${Boton} tipo="peligro" onClick=${borrar}>Borrar lote<//>
        </div>
      </form>
    <//>
  `;
}
