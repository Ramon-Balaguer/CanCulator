// IndexedDB: apertura y migraciones versionadas. Las migraciones solo crean lo que falta;
// nunca borran tablas ni datos.

export const DB_NAME = 'inventario-casa';

// Tablas: los mismos nombres que en la Google Sheet.
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

// MIGRACIONES[n] lleva de la versión n-1 a la n. Añadir nuevas al final, no editar las anteriores.
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
  // v2: caché de Open Food Facts (fase 3).
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
      // Si otra versión de la app (más nueva) quiere actualizar la base de datos, esta conexión
      // se cierra para no bloquearla. La app avisa de que hay que recargar.
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

// Ejecuta fn(tx) dentro de una transacción. fn puede esperar peticiones de IndexedDB
// con await (son parte de la transacción), pero nunca otras promesas externas.
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
        try { tx.abort(); } catch { /* ya terminada */ }
      });
  });
}
