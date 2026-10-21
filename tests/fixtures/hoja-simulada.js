// Simulación en memoria de las APIs de Google Apps Script que usa apps-script/Code.gs.
// Sirve para ejecutar el servidor real en Node (tests unitarios y servidor de pruebas E2E).

export function createAppsEnv(book = new Map()) {
  const locks = { activos: 0 };

  class SheetMock {
    constructor(name) {
      this.nombre = name;
      this.filas = [];
      this.maxFilas = 1000;
    }
    getName() { return this.nombre; }
    getMaxRows() { return this.maxFilas; }
    getLastRow() { return this.filas.length; }
    getLastColumn() { return this.filas.reduce((m, f) => Math.max(m, f.length), 0); }
    getDataRange() {
      const rows = this.filas;
      const columns = rows.reduce((m, f) => Math.max(m, f.length), 0);
      return {
        getValues: () => rows.map((f) => Array.from({ length: columns }, (_, j) => (f[j] ?? ''))),
      };
    }
    getRange(row, column, numFilas = 1, numColumnas = 1) {
      const sheet = this;
      return {
        setNumberFormat() { return this; },
        setValue(value) { return this.setValues([[value]]); },
        getValues() {
          return Array.from({ length: numFilas }, (_, i) =>
            Array.from({ length: numColumnas }, (_, j) => (sheet.filas[row - 1 + i]?.[column - 1 + j] ?? '')));
        },
        setValues(values) {
          // "fila" aquí es el número de fila del rango (como en Sheets), no la fila de valores.
          values.forEach((rowValues, i) => {
            while (sheet.filas.length < row + i) sheet.filas.push([]);
            const destination = sheet.filas[row - 1 + i];
            rowValues.forEach((value, j) => { destination[column - 1 + j] = value; });
          });
          return this;
        },
      };
    }
    appendRow(values) {
      this.filas.push(values.map((v) => (v === null || v === undefined ? '' : v)));
    }
  }

  const simulatedBook = {
    getSheetByName: (name) => book.get(name) ?? null,
    insertSheet: (name) => { const h = new SheetMock(name); book.set(name, h); return h; },
  };

  const properties = new Map();

  const folders = new Map();
  const fileList = new Map();
  class ListIterator {
    constructor(list) { this.lista = list; this.i = 0; }
    hasNext() { return this.i < this.lista.length; }
    next() { return this.lista[this.i++]; }
  }
  const fakeFolder = (name) => ({
    getName: () => name,
    getFilesByName: (n) => new ListIterator((fileList.get(name) ?? []).filter((f) => f.getName() === n)),
    createFile(blob) {
      const id = `drive-${fileList.size + 1}-${blob.nombre}`;
      const fileEntry = { getId: () => id, getName: () => blob.nombre, blob };
      if (!fileList.has(name)) fileList.set(name, []);
      fileList.get(name).push(fileEntry);
      return fileEntry;
    },
  });

  const environment = {
    SpreadsheetApp: { getActiveSpreadsheet: () => simulatedBook },
    LockService: {
      getScriptLock: () => ({
        waitLock() { locks.activos++; },
        releaseLock() { locks.activos--; },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => properties.get(k) ?? null,
        setProperty: (k, v) => properties.set(k, v),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        const output = { texto: text, tipo: null };
        return { setMimeType(type) { output.tipo = type; return output; }, ...output };
      },
    },
    Utilities: {
      formatDate: (date, _zona, format) => {
        const day = date.toISOString().slice(0, 10);
        return format === 'yyyy-MM-dd' ? day : date.toISOString();
      },
      newBlob: (bytes, type, name) => ({ bytes, tipo: type, nombre: name }),
      base64Decode: (text) => text,
    },
    DriveApp: {
      getFoldersByName: (name) => new ListIterator(folders.has(name) ? [folders.get(name)] : []),
      createFolder: (name) => { const c = fakeFolder(name); folders.set(name, c); return c; },
    },
  };

  return { entorno: environment, libro: book, propiedades: properties, bloqueos: locks, ficheros: fileList, Hoja: SheetMock };
}
