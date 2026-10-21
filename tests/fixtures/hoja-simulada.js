// Simulación en memoria de las APIs de Google Apps Script que usa apps-script/Code.gs.
// Sirve para ejecutar el servidor real en Node (tests unitarios y servidor de pruebas E2E).

export function crearEntornoApps(libro = new Map()) {
  const bloqueos = { activos: 0 };

  class Hoja {
    constructor(nombre) {
      this.nombre = nombre;
      this.filas = [];
      this.maxFilas = 1000;
    }
    getName() { return this.nombre; }
    getMaxRows() { return this.maxFilas; }
    getLastRow() { return this.filas.length; }
    getLastColumn() { return this.filas.reduce((m, f) => Math.max(m, f.length), 0); }
    getDataRange() {
      const filas = this.filas;
      const columnas = filas.reduce((m, f) => Math.max(m, f.length), 0);
      return {
        getValues: () => filas.map((f) => Array.from({ length: columnas }, (_, j) => (f[j] ?? ''))),
      };
    }
    getRange(fila, columna, numFilas = 1, numColumnas = 1) {
      const hoja = this;
      return {
        setNumberFormat() { return this; },
        setValue(valor) { return this.setValues([[valor]]); },
        getValues() {
          return Array.from({ length: numFilas }, (_, i) =>
            Array.from({ length: numColumnas }, (_, j) => (hoja.filas[fila - 1 + i]?.[columna - 1 + j] ?? '')));
        },
        setValues(valores) {
          // "fila" aquí es el número de fila del rango (como en Sheets), no la fila de valores.
          valores.forEach((valoresFila, i) => {
            while (hoja.filas.length < fila + i) hoja.filas.push([]);
            const destino = hoja.filas[fila - 1 + i];
            valoresFila.forEach((valor, j) => { destino[columna - 1 + j] = valor; });
          });
          return this;
        },
      };
    }
    appendRow(valores) {
      this.filas.push(valores.map((v) => (v === null || v === undefined ? '' : v)));
    }
  }

  const libroSimulado = {
    getSheetByName: (nombre) => libro.get(nombre) ?? null,
    insertSheet: (nombre) => { const h = new Hoja(nombre); libro.set(nombre, h); return h; },
  };

  const propiedades = new Map();

  const carpetas = new Map();
  const ficheros = new Map();
  class Iterador {
    constructor(lista) { this.lista = lista; this.i = 0; }
    hasNext() { return this.i < this.lista.length; }
    next() { return this.lista[this.i++]; }
  }
  const carpetaFake = (nombre) => ({
    getName: () => nombre,
    getFilesByName: (n) => new Iterador((ficheros.get(nombre) ?? []).filter((f) => f.getName() === n)),
    createFile(blob) {
      const id = `drive-${ficheros.size + 1}-${blob.nombre}`;
      const archivo = { getId: () => id, getName: () => blob.nombre, blob };
      if (!ficheros.has(nombre)) ficheros.set(nombre, []);
      ficheros.get(nombre).push(archivo);
      return archivo;
    },
  });

  const entorno = {
    SpreadsheetApp: { getActiveSpreadsheet: () => libroSimulado },
    LockService: {
      getScriptLock: () => ({
        waitLock() { bloqueos.activos++; },
        releaseLock() { bloqueos.activos--; },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => propiedades.get(k) ?? null,
        setProperty: (k, v) => propiedades.set(k, v),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(texto) {
        const salida = { texto, tipo: null };
        return { setMimeType(tipo) { salida.tipo = tipo; return salida; }, ...salida };
      },
    },
    Utilities: {
      formatDate: (fecha, _zona, formato) => {
        const dia = fecha.toISOString().slice(0, 10);
        return formato === 'yyyy-MM-dd' ? dia : fecha.toISOString();
      },
      newBlob: (bytes, tipo, nombre) => ({ bytes, tipo, nombre }),
      base64Decode: (texto) => texto,
    },
    DriveApp: {
      getFoldersByName: (nombre) => new Iterador(carpetas.has(nombre) ? [carpetas.get(nombre)] : []),
      createFolder: (nombre) => { const c = carpetaFake(nombre); carpetas.set(nombre, c); return c; },
    },
  };

  return { entorno, libro, propiedades, bloqueos, ficheros, Hoja };
}
