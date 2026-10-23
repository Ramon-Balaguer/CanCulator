// Entry and exit of JSON backups in the browser. The logic is in js/logica/backup.js.
import { buildBackup, mergeBackup, validateBackup } from '../logica/backup.js';
import { TABLES, request, transaction } from './db.js';
import { t } from '../logica/idioma.js';

const encodeBytes = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const decodeBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export async function exportBackup(db, device) {
  const { productos: products, lotes: lots, configuracion: configuration, operaciones: operations, fotos: photos } = await transaction(
    db,
    [TABLES.productos, TABLES.lotes, TABLES.configuracion, TABLES.operaciones, TABLES.fotos],
    'readonly',
    async (tx) => ({
      productos: await request(tx.objectStore(TABLES.productos).getAll()),
      lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
      configuracion: await request(tx.objectStore(TABLES.configuracion).getAll()),
      operaciones: await request(tx.objectStore(TABLES.operaciones).getAll()),
      fotos: await request(tx.objectStore(TABLES.fotos).getAll()),
    }),
  );
  const photosBase64 = photos.map((photo) => ({
    id: photo.id,
    creada: photo.creada,
    tipo: photo.tipo,
    dato: encodeBytes(photo.bytes),
  }));
  const backup = buildBackup({ dispositivo: device, productos: products, lotes: lots, configuracion: configuration, fotos: photosBase64 });
  // Pending operations are also included, so the queue is not lost if it is restored on another phone.
  backup.operaciones_pendientes = operations;
  return {
    nombre: `inventario-${backup.exportado.slice(0, 10)}.json`,
    texto: JSON.stringify(backup, null, 2),
  };
}

// Reads a file, validates it and merges it with what is on the phone. Returns the summary.
export async function importBackupFile(db, uploadedFile) {
  const text = await uploadedFile.text();
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error(t('backup.no_json'));
  }
  validateBackup(backup);
  const newPhotos = (backup.fotos ?? []).map((f) => ({
    id: f.id,
    creada: f.creada,
    tipo: f.tipo ?? 'image/jpeg',
    bytes: decodeBase64(f.dato),
  }));

  return transaction(db, Object.values(TABLES), 'readwrite', async (tx) => {
    const local = {
      productos: await request(tx.objectStore(TABLES.productos).getAll()),
      lotes: await request(tx.objectStore(TABLES.lotes).getAll()),
      configuracion: await request(tx.objectStore(TABLES.configuracion).getAll()),
      fotos: await request(tx.objectStore(TABLES.fotos).getAll()),
    };
    const merge = mergeBackup(local, backup);
    const write = (table, records) => {
      const objectStore = tx.objectStore(table);
      for (const r of records) objectStore.put(r);
    };
    write(TABLES.productos, merge.productos);
    write(TABLES.lotes, merge.lotes);
    write(TABLES.configuracion, merge.configuracion);
    const localPhotoIds = new Set(local.fotos.map((f) => f.id));
    write(TABLES.fotos, newPhotos.filter((f) => !localPhotoIds.has(f.id)));
    return merge.resumen;
  });
}

// Empties every table, Meta included (device id and sync token), so the app starts from zero.
export function resetDatabase(db) {
  return transaction(db, Object.values(TABLES), 'readwrite', async (tx) => {
    for (const table of Object.values(TABLES)) {
      await request(tx.objectStore(table).clear());
    }
  });
}

export function downloadText({ nombre: name, texto: text }) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
