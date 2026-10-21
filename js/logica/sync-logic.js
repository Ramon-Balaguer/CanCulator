// Reglas de sincronización del móvil. Sin acceso a red ni a IndexedDB.
// El servidor (apps-script/Code.gs) aplica las mismas reglas sobre la hoja.

export const ACTIONS = Object.freeze({ SINCRONIZAR: 'sincronizar', FOTO: 'foto', PING: 'ping' });

// Clave de una entidad para saber si tiene operaciones sin confirmar.
const entityKey = (entity, id) => `${entity}:${id}`;

export function pendingEntities(operations) {
  return new Set(operations.map((o) => entityKey(o.entidad, o.entidad_id)));
}

// Qué se envía en una sincronización. "desde" es la última sincronización confirmada.
export function buildSyncRequest({ token, dispositivo: device, operaciones: operations, desde: since = '', configuracion: configuration = [] }) {
  return {
    accion: ACTIONS.SINCRONIZAR,
    token,
    dispositivo: device,
    desde: since,
    operaciones: operations.map((o) => ({ ...o })),
    configuracion: configuration.map((c) => ({
      clave: c.clave,
      valor: JSON.stringify(c.valor),
      actualizado: c.actualizado ?? '',
    })),
  };
}

// Valida la respuesta del servidor. Lanza con un mensaje para el usuario si no es válida.
export function parseSyncResponse(response) {
  if (!response || typeof response !== 'object') throw new Error('Respuesta del servidor no válida');
  if (response.ok !== true) throw new Error(response.error || 'El servidor no pudo sincronizar');
  if (!Array.isArray(response.aplicadas) || !Array.isArray(response.duplicadas)) {
    throw new Error('Respuesta del servidor incompleta');
  }
  if (typeof response.ahora !== 'string') throw new Error('Respuesta del servidor sin hora de sincronización');
  return response;
}

// Operaciones que el servidor ya tiene: se pueden borrar del móvil.
// Las duplicadas también cuentan: el servidor ya las aplicó antes.
export function confirmedIds(response) {
  return new Set([...response.aplicadas, ...response.duplicadas]);
}

// Convierte un registro de la hoja al formato del móvil.
function fromSheet(record, table) {
  const r = { ...record };
  if (table === 'lotes') r.cantidad = Number(r.cantidad);
  if (table === 'productos') {
    r.stock_minimo = Number(r.stock_minimo);
    // Calorías: vacío en la hoja significa "sin dato", no cero.
    r.kcal_100g = r.kcal_100g === undefined || r.kcal_100g === '' ? '' : Number(r.kcal_100g);
    r.peso_bote_g = r.peso_bote_g === undefined || r.peso_bote_g === '' ? '' : Number(r.peso_bote_g);
  }
  if (table === 'configuracion') r.valor = JSON.parse(r.valor);
  if (typeof r.borrado !== 'boolean') r.borrado = r.borrado === 'sí' || r.borrado === true;
  return r;
}

// Aplica los cambios del servidor al estado local.
// - Si una entidad tiene operaciones sin confirmar, se deja como está: se sincronizará después.
// - Si no, gana el registro con "actualizado" más reciente (en empate, el del servidor).
export function applyServerChanges(local, changes, pending) {
  const result = {};
  for (const table of ['productos', 'lotes', 'configuracion']) {
    const entity = table === 'productos' ? 'producto' : table === 'lotes' ? 'lote' : 'configuracion';
    const byId = new Map((local[table] ?? []).map((r) => [table === 'configuracion' ? r.clave : r.id, r]));
    for (const remote of changes[table] ?? []) {
      const key = table === 'configuracion' ? remote.clave : remote.id;
      if (pending.has(entityKey(entity, key))) continue;
      const newItem = fromSheet(remote, table);
      const current = byId.get(key);
      if (!current || (newItem.actualizado ?? '') >= (current.actualizado ?? '')) {
        byId.set(key, newItem);
      }
    }
    result[table] = [...byId.values()];
  }
  return result;
}
