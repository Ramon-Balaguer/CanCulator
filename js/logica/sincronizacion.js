// Reglas de sincronización del móvil. Sin acceso a red ni a IndexedDB.
// El servidor (apps-script/Code.gs) aplica las mismas reglas sobre la hoja.

export const ACCIONES = Object.freeze({ SINCRONIZAR: 'sincronizar', FOTO: 'foto', PING: 'ping' });

// Clave de una entidad para saber si tiene operaciones sin confirmar.
const claveEntidad = (entidad, id) => `${entidad}:${id}`;

export function entidadesPendientes(operaciones) {
  return new Set(operaciones.map((o) => claveEntidad(o.entidad, o.entidad_id)));
}

// Qué se envía en una sincronización. "desde" es la última sincronización confirmada.
export function construirPeticionSync({ token, dispositivo, operaciones, desde = '', configuracion = [] }) {
  return {
    accion: ACCIONES.SINCRONIZAR,
    token,
    dispositivo,
    desde,
    operaciones: operaciones.map((o) => ({ ...o })),
    configuracion: configuracion.map((c) => ({
      clave: c.clave,
      valor: JSON.stringify(c.valor),
      actualizado: c.actualizado ?? '',
    })),
  };
}

// Valida la respuesta del servidor. Lanza con un mensaje para el usuario si no es válida.
export function interpretarRespuestaSync(respuesta) {
  if (!respuesta || typeof respuesta !== 'object') throw new Error('Respuesta del servidor no válida');
  if (respuesta.ok !== true) throw new Error(respuesta.error || 'El servidor no pudo sincronizar');
  if (!Array.isArray(respuesta.aplicadas) || !Array.isArray(respuesta.duplicadas)) {
    throw new Error('Respuesta del servidor incompleta');
  }
  if (typeof respuesta.ahora !== 'string') throw new Error('Respuesta del servidor sin hora de sincronización');
  return respuesta;
}

// Operaciones que el servidor ya tiene: se pueden borrar del móvil.
// Las duplicadas también cuentan: el servidor ya las aplicó antes.
export function idsConfirmados(respuesta) {
  return new Set([...respuesta.aplicadas, ...respuesta.duplicadas]);
}

// Convierte un registro de la hoja al formato del móvil.
function desdeHoja(registro, tabla) {
  const r = { ...registro };
  if (tabla === 'lotes') r.cantidad = Number(r.cantidad);
  if (tabla === 'productos') r.stock_minimo = Number(r.stock_minimo);
  if (tabla === 'configuracion') r.valor = JSON.parse(r.valor);
  if (typeof r.borrado !== 'boolean') r.borrado = r.borrado === 'sí' || r.borrado === true;
  return r;
}

// Aplica los cambios del servidor al estado local.
// - Si una entidad tiene operaciones sin confirmar, se deja como está: se sincronizará después.
// - Si no, gana el registro con "actualizado" más reciente (en empate, el del servidor).
export function aplicarCambiosServidor(local, cambios, pendientes) {
  const resultado = {};
  for (const tabla of ['productos', 'lotes', 'configuracion']) {
    const entidad = tabla === 'productos' ? 'producto' : tabla === 'lotes' ? 'lote' : 'configuracion';
    const porId = new Map((local[tabla] ?? []).map((r) => [tabla === 'configuracion' ? r.clave : r.id, r]));
    for (const remoto of cambios[tabla] ?? []) {
      const clave = tabla === 'configuracion' ? remoto.clave : remoto.id;
      if (pendientes.has(claveEntidad(entidad, clave))) continue;
      const nuevo = desdeHoja(remoto, tabla);
      const actual = porId.get(clave);
      if (!actual || (nuevo.actualizado ?? '') >= (actual.actualizado ?? '')) {
        porId.set(clave, nuevo);
      }
    }
    resultado[tabla] = [...porId.values()];
  }
  return resultado;
}
