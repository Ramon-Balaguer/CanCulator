// JSON backup of the inventory: build, validate and merge. No IndexedDB access.
// The merge follows the same rule as the sync: the record with the most recent "updated" wins.

export const BACKUP_VERSION = 1;

export function buildBackup({ dispositivo: device, productos: products, lotes: lots, configuracion: configuration, fotos: photos = [], fecha: date = new Date().toISOString() }) {
  return {
    formato: 'inventario-casa',
    version: BACKUP_VERSION,
    exportado: date,
    dispositivo: device,
    productos: products,
    lotes: lots,
    configuracion: configuration,
    // Photos go in base64 so the JSON is self-contained.
    fotos: photos,
  };
}

const LISTS = ['productos', 'lotes', 'configuracion', 'fotos'];

export function validateBackup(backup) {
  if (!backup || typeof backup !== 'object') throw new Error('El fichero no es una copia válida');
  if (backup.formato !== 'inventario-casa') throw new Error('El fichero no es una copia de Inventario de casa');
  if (!Number.isInteger(backup.version) || backup.version > BACKUP_VERSION) {
    throw new Error(`La copia es de una versión más nueva (${backup.version}). Actualiza la app.`);
  }
  for (const list of LISTS) {
    if (backup[list] !== undefined && !Array.isArray(backup[list])) {
      throw new Error(`La copia tiene un campo "${list}" que no es una lista`);
    }
  }
  for (const product of backup.productos ?? []) {
    if (!product.id || typeof product.nombre !== 'string') throw new Error('Hay un producto sin id o sin nombre');
  }
  for (const lot of backup.lotes ?? []) {
    if (!lot.id || !lot.producto_id) throw new Error('Hay un lote sin id o sin producto');
    if (!Number.isInteger(lot.cantidad) || lot.cantidad < 0) throw new Error(`Cantidad no válida en el lote ${lot.id}`);
  }
  return backup;
}

// Merges a local record with one from the backup. By id; if both exist, the most recent wins.
// Tie: the local one, so nothing changes without a reason.
function mergeList(local, incoming) {
  const map = new Map(local.map((r) => [r.id, r]));
  let newItems = 0;
  let updatedItems = 0;
  for (const r of incoming) {
    const current = map.get(r.id);
    if (!current) {
      map.set(r.id, r);
      newItems++;
    } else if ((r.actualizado ?? '') > (current.actualizado ?? '')) {
      map.set(r.id, r);
      updatedItems++;
    }
  }
  return { registros: [...map.values()], nuevos: newItems, actualizados: updatedItems };
}

// Returns the result of merging without touching anything. "settings" has no date: the backup
// text/plain (no CORS preflight), JSON body, redirects followed.
export function mergeBackup(local, backup) {
  const products = mergeList(local.productos, backup.productos ?? []);
  const lots = mergeList(local.lotes, backup.lotes ?? []);
  const photos = mergeList(local.fotos ?? [], backup.fotos ?? []);

  const configuration = new Map((local.configuracion ?? []).map((c) => [c.clave, c]));
  for (const c of backup.configuracion ?? []) configuration.set(c.clave, c);

  return {
    productos: products.registros,
    lotes: lots.registros,
    fotos: photos.registros,
    configuracion: [...configuration.values()],
    resumen: {
      productos: products.nuevos + products.actualizados,
      lotes: lots.nuevos + lots.actualizados,
      fotos: photos.nuevos,
    },
  };
}
