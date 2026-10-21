// Sync rules of the phone. No network or IndexedDB access.
// The server (apps-script/Code.gs) applies the same rules on the sheet.

export const ACTIONS = Object.freeze({ SINCRONIZAR: 'sincronizar', FOTO: 'foto', PING: 'ping' });

// Key of an entity to know if it has operations not yet confirmed.
const entityKey = (entity, id) => `${entity}:${id}`;

export function pendingEntities(operations) {
  return new Set(operations.map((o) => entityKey(o.entidad, o.entidad_id)));
}

// What is sent in a sync. "since" is the last confirmed sync.
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

// Validates the server response. Throws with a message for the user if it is not valid.
export function parseSyncResponse(response) {
  if (!response || typeof response !== 'object') throw new Error('Respuesta del servidor no válida');
  if (response.ok !== true) throw new Error(response.error || 'El servidor no pudo sincronizar');
  if (!Array.isArray(response.aplicadas) || !Array.isArray(response.duplicadas)) {
    throw new Error('Respuesta del servidor incompleta');
  }
  if (typeof response.ahora !== 'string') throw new Error('Respuesta del servidor sin hora de sincronización');
  return response;
}

// Operations the server already has: they can be deleted from the phone.
// Duplicates count too: the server already applied them before.
export function confirmedIds(response) {
  return new Set([...response.aplicadas, ...response.duplicadas]);
}

// Converts a sheet record to the phone format.
function fromSheet(record, table) {
  const r = { ...record };
  if (table === 'lotes') r.cantidad = Number(r.cantidad);
  if (table === 'productos') {
    r.stock_minimo = Number(r.stock_minimo);
    // Calories: an empty value in the sheet means "no data", not zero.
    r.kcal_100g = r.kcal_100g === undefined || r.kcal_100g === '' ? '' : Number(r.kcal_100g);
    r.peso_bote_g = r.peso_bote_g === undefined || r.peso_bote_g === '' ? '' : Number(r.peso_bote_g);
  }
  if (table === 'configuracion') r.valor = JSON.parse(r.valor);
  if (typeof r.borrado !== 'boolean') r.borrado = r.borrado === 'sí' || r.borrado === true;
  return r;
}

// Applies the server changes to the local state.
// - If an entity has operations not yet confirmed, it is left as is: it will be synced later.
// - If not, the record with the most recent "updated" wins (on a tie, the server's).
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
