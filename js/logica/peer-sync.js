// Sincronización directa entre móviles (WebRTC). Reglas puras, sin red ni IndexedDB.
// Aplican criterios de conflicto (gana el cambio más reciente) a las operaciones recibidas.

export const PROTOCOLO = 'canculator/1';

// Huella del token para el saludo inicial: el token nunca viaja en claro por el canal.
export async function hashToken(token, subtle = globalThis.crypto.subtle) {
  const bytes = new TextEncoder().encode(`${PROTOCOLO}|${token}`);
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const maxFecha = (a, b) => (a && a > b ? a : b);

// Aplica operaciones recibidas de otro móvil a una copia del estado local.
// Los ajustes (categorías, ubicaciones...) se guardan por clave; gana el cambio más reciente.
function aplicarAjuste(ajustes, op) {
  const actual = ajustes.find((a) => a.clave === op.entidad_id);
  if (actual && op.fecha < actual.actualizado) return;
  if (actual) Object.assign(actual, { valor: op.cambio.valor, actualizado: op.fecha });
  else ajustes.push({ clave: op.entidad_id, valor: op.cambio.valor, actualizado: op.fecha });
}

// state: { productos: [...], lotes: [...], configuracion: [...] }. appliedIds: Set de ids ya aplicados (no se repiten).
// Devuelve { state, applied: [ids aplicados ahora] }. No modifica los objetos de entrada.
export function applyRemoteOps(state, ops, appliedIds) {
  const productos = state.productos.map((p) => ({ ...p }));
  const lotes = state.lotes.map((l) => ({ ...l }));
  const configuracion = (state.configuracion ?? []).map((c) => ({ ...c }));
  const applied = [];

  const buscar = (lista, id) => lista.find((r) => r.id === id);

  for (const op of [...ops].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    if (appliedIds.has(op.id)) continue;
    if (op.entidad === 'configuracion') {
      aplicarAjuste(configuracion, op);
      applied.push(op.id);
      continue;
    }
    const esProducto = op.entidad === 'producto';
    const lista = esProducto ? productos : lotes;

    switch (op.tipo) {
      case 'crear': {
        if (!buscar(lista, op.entidad_id)) {
          const nuevo = { id: op.entidad_id, ...op.cambio, actualizado: op.fecha, borrado: false };
          if (!esProducto) nuevo.revisar = 'no';
          lista.push(nuevo);
        }
        break;
      }
      case 'editar': {
        const r = buscar(lista, op.entidad_id);
        if (!r || r.borrado) break;
        if (op.fecha < r.actualizado) break;
        Object.assign(r, op.cambio, { actualizado: op.fecha });
        break;
      }
      case 'consumir':
      case 'reponer': {
        const r = buscar(lista, op.entidad_id);
        if (!r) break;
        let cantidad = Number(r.cantidad) + Number(op.cambio.cantidad);
        if (cantidad < 0) {
          cantidad = 0;
          r.revisar = 'sí';
        }
        r.cantidad = cantidad;
        r.actualizado = maxFecha(r.actualizado, op.fecha);
        break;
      }
      case 'borrar': {
        const r = buscar(lista, op.entidad_id);
        if (!r) break;
        r.borrado = true;
        r.actualizado = maxFecha(r.actualizado, op.fecha);
        break;
      }
      default:
        break;
    }
    applied.push(op.id);
  }
  return { state: { productos, lotes, configuracion }, applied };
}

// Fusión de un snapshot completo (todos los productos, lotes y ajustes del otro móvil).
// Cada registro gana el de fecha más reciente; los que solo existen en el otro móvil se añaden.
// Sirve para recuperar lo que no llegó por operaciones y para que los dos móviles acaben iguales.
function fusionarPorFecha(locales, remotos, claveDe) {
  const mapa = new Map(locales.map((r) => [claveDe(r), { ...r }]));
  let changed = 0;
  for (const r of remotos) {
    const actual = mapa.get(claveDe(r));
    if (!actual || r.actualizado > actual.actualizado) {
      mapa.set(claveDe(r), { ...r });
      changed++;
    }
  }
  return { lista: [...mapa.values()], changed };
}

// state: { productos, lotes, configuracion }; remote: el snapshot recibido con la misma forma.
// Devuelve { state, changed: número de registros añadidos o cambiados }. No modifica las entradas.
export function mergeSnapshot(state, remote) {
  const productos = fusionarPorFecha(state.productos, remote.productos ?? [], (p) => p.id);
  const lotes = fusionarPorFecha(state.lotes, remote.lotes ?? [], (l) => l.id);
  const configuracion = fusionarPorFecha(state.configuracion ?? [], remote.configuracion ?? [], (c) => c.clave);
  return {
    state: { productos: productos.lista, lotes: lotes.lista, configuracion: configuracion.lista },
    changed: productos.changed + lotes.changed + configuracion.changed,
  };
}

// Invitación para el QR: código de la sala y token, en un solo texto.
const PREFIJO_INVITACION = 'canculator:';
const CODIGO_SALA = /^[A-Z2-9]{6}$/;

export function encodeInvite({ code, token }) {
  return `${PREFIJO_INVITACION}${code}:${token}`;
}

// Devuelve { code, token } o null si el texto no es una invitación válida.
export function decodeInvite(text) {
  const t = String(text ?? '').trim();
  if (!t.startsWith(PREFIJO_INVITACION)) return null;
  const resto = t.slice(PREFIJO_INVITACION.length);
  const separador = resto.indexOf(':');
  if (separador < 0) return null;
  const code = resto.slice(0, separador).toUpperCase();
  const token = resto.slice(separador + 1);
  if (!CODIGO_SALA.test(code) || token === '') return null;
  return { code, token };
}
