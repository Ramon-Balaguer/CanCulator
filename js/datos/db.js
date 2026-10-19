// IndexedDB: apertura y migraciones versionadas. Las migraciones solo crean lo que falta;
// nunca borran tablas ni datos.

export const NOMBRE_BD = 'inventario-casa';

// Tablas: los mismos nombres que en la Google Sheet.
export const TABLAS = Object.freeze({
  productos: 'Productos',
  lotes: 'Lotes',
  configuracion: 'Configuracion',
  operaciones: 'Operaciones',
  fotos: 'Fotos',
  meta: 'Meta',
  cacheOff: 'cache_off',
});

const crearSiFalta = (db, nombre, opciones) => {
  if (!db.objectStoreNames.contains(nombre)) db.createObjectStore(nombre, opciones);
};

// MIGRACIONES[n] lleva de la versión n-1 a la n. Añadir nuevas al final, no editar las anteriores.
const MIGRACIONES = [
  null,
  (db) => {
    crearSiFalta(db, TABLAS.productos, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(TABLAS.lotes)) {
      db.createObjectStore(TABLAS.lotes, { keyPath: 'id' }).createIndex('producto_id', 'producto_id');
    }
    crearSiFalta(db, TABLAS.configuracion, { keyPath: 'clave' });
    crearSiFalta(db, TABLAS.operaciones, { keyPath: 'id' });
    crearSiFalta(db, TABLAS.fotos, { keyPath: 'id' });
    crearSiFalta(db, TABLAS.meta, { keyPath: 'clave' });
  },
  // v2: caché de Open Food Facts (fase 3).
  (db) => {
    crearSiFalta(db, TABLAS.cacheOff, { keyPath: 'codigo' });
  },
];

export const VERSION_ESQUEMA = MIGRACIONES.length - 1;

export function abrirBD(nombre = NOMBRE_BD, indexedDB = globalThis.indexedDB) {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(nombre, VERSION_ESQUEMA);
    peticion.onupgradeneeded = (evento) => {
      const db = peticion.result;
      const tx = peticion.transaction;
      for (let v = (evento.oldVersion ?? 0) + 1; v <= VERSION_ESQUEMA; v++) {
        MIGRACIONES[v](db, tx);
      }
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
    peticion.onblocked = () => rechazar(new Error('La base de datos está abierta en otra pestaña. Ciérrala y recarga.'));
  });
}

export function peticion(req) {
  return new Promise((resolver, rechazar) => {
    req.onsuccess = () => resolver(req.result);
    req.onerror = () => rechazar(req.error);
  });
}

// Ejecuta fn(tx) dentro de una transacción. fn puede esperar peticiones de IndexedDB
// con await (son parte de la transacción), pero nunca otras promesas externas.
export function transaccion(db, tablas, modo, fn) {
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(tablas, modo);
    let resultado;
    let fallo = null;
    tx.oncomplete = () => (fallo ? rechazar(fallo) : resolver(resultado));
    tx.onerror = () => { fallo ??= tx.error; };
    tx.onabort = () => rechazar(fallo ?? tx.error ?? new Error('Transacción cancelada'));
    Promise.resolve()
      .then(() => fn(tx))
      .then((valor) => { resultado = valor; })
      .catch((error) => {
        fallo = error;
        try { tx.abort(); } catch { /* ya terminada */ }
      });
  });
}
