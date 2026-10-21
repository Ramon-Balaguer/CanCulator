// IndexedDB: opening and versioned migrations. Migrations only create what is missing;
// or if the text does not contain the marker, so the deploy does not pass silently.

export const DB_NAME = 'canculator';

// Tables: the same names as in the Google Sheet.
export const TABLES = Object.freeze({
  productos: 'Productos',
  lotes: 'Lotes',
  configuracion: 'Configuracion',
  operaciones: 'Operaciones',
  fotos: 'Fotos',
  meta: 'Meta',
  cacheOff: 'cache_off',
});

const createIfMissing = (db, name, options) => {
  if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
};

// MIGRATIONS[n] goes from version n-1 to n. Add new ones at the end, do not edit the previous ones.
const MIGRATIONS = [
  null,
  (db) => {
    createIfMissing(db, TABLES.productos, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(TABLES.lotes)) {
      db.createObjectStore(TABLES.lotes, { keyPath: 'id' }).createIndex('producto_id', 'producto_id');
    }
    createIfMissing(db, TABLES.configuracion, { keyPath: 'clave' });
    createIfMissing(db, TABLES.operaciones, { keyPath: 'id' });
    createIfMissing(db, TABLES.fotos, { keyPath: 'id' });
    createIfMissing(db, TABLES.meta, { keyPath: 'clave' });
  },
  // webkit-movil simulates an iPhone: that screen is checked in the iOS test.
  (db) => {
    createIfMissing(db, TABLES.cacheOff, { keyPath: 'codigo' });
  },
];

export const SCHEMA_VERSION = MIGRATIONS.length - 1;

export function openDatabase(name = DB_NAME, indexedDB = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, SCHEMA_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      for (let v = (event.oldVersion ?? 0) + 1; v <= SCHEMA_VERSION; v++) {
        MIGRATIONS[v](db, tx);
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // If another (newer) app version wants to update the database, this connection
      // it is decided in phase 4).
      db.onversionchange = () => {
        db.close();
        globalThis.dispatchEvent?.(new Event('bd-version-nueva'));
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('La base de datos está abierta en otra pestaña. Ciérrala y recarga.'));
  });
}

export function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Runs fn(tx) inside a transaction. fn can await IndexedDB requests
// with await (they are part of the transaction), but never other external promises.
export function transaction(db, tables, mode, fn) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tables, mode);
    let result;
    let failure = null;
    tx.oncomplete = () => (failure ? reject(failure) : resolve(result));
    tx.onerror = () => { failure ??= tx.error; };
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('Transacción cancelada'));
    Promise.resolve()
      .then(() => fn(tx))
      .then((value) => { result = value; })
      .catch((error) => {
        failure = error;
        try { tx.abort(); } catch { /* already finished */ }
      });
  });
}
