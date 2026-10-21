// Inventario de casa: servidor de sincronización (Google Apps Script).
// Se pega en el proyecto de Apps Script ligado a la hoja compartida y se despliega como
// aplicación web (ejecutar como: yo; acceso: cualquier usuario). Ver docs/apps-script.md.
//
// Pestañas de la hoja: Productos, Lotes, Configuracion, Dispositivos, Aplicadas.
// Las operaciones (Operaciones) solo existen en el móvil.

const SERVER_VERSION = '1';
const PHOTOS_FOLDER = 'inventario-fotos';
const TIME_ZONE = 'Europe/Madrid';

const COLUMNS = {
  Productos: ['id', 'nombre', 'categoria', 'codigo_barras', 'stock_minimo', 'actualizado', 'borrado', 'kcal_100g', 'peso_bote_g'],
  Lotes: ['id', 'producto_id', 'cantidad', 'caducidad', 'ubicacion', 'observaciones', 'foto_id', 'revisar', 'actualizado', 'borrado'],
  Configuracion: ['clave', 'valor', 'actualizado'],
  Dispositivos: ['dispositivo', 'ultima_sincronizacion'],
  Aplicadas: ['id', 'dispositivo', 'aplicada'],
};

// ---------- Entrada HTTP ----------

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    verifyToken(request.token);
    let response;
    if (request.accion === 'ping') {
      response = { ok: true, version: SERVER_VERSION };
    } else if (request.accion === 'sincronizar') {
      response = sync(request);
    } else if (request.accion === 'foto') {
      response = uploadPhoto(request);
    } else {
      throw new Error('Acción desconocida');
    }
    return output(response);
  } catch (error) {
    return output({ ok: false, error: error.message });
  }
}

function output(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}

function verifyToken(token) {
  const esperado = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!esperado) throw new Error('El script no tiene token configurado');
  if (token !== esperado) throw new Error('Token no válido');
}

// ---------- Sincronización ----------

function sync(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheets = openSheets();
    const yaAplicadas = new Set(readRows(sheets.Aplicadas).map((f) => f.id));
    const avisos = [];
    const aplicadas = [];
    const duplicadas = [];

    for (const operacion of request.operaciones || []) {
      if (yaAplicadas.has(operacion.id)) {
        duplicadas.push(operacion.id);
        continue;
      }
      const notice = applyOperation(sheets, operacion);
      if (notice) avisos.push(`${operacion.id}: ${notice}`);
      sheets.Aplicadas.appendRow(rowFrom(COLUMNS.Aplicadas, {
        id: operacion.id,
        dispositivo: request.dispositivo,
        aplicada: new Date().toISOString(),
      }));
      yaAplicadas.add(operacion.id);
      aplicadas.push(operacion.id);
    }

    applySettings(sheets, request.configuracion || []);

    // Se devuelven todas las filas, no solo las posteriores a "desde": "actualizado" guarda la
    // fecha del móvil que hizo el cambio (sirve para resolver conflictos), y un cambio hecho
    // sin conexión puede tener una fecha anterior a la última sincronización de otro móvil.
    // Filtrar por ella dejaría a ese otro móvil sin el cambio. El volumen de una casa es pequeño.
    // "desde" queda en la petición por si más adelante se separa la fecha de servidor.
    const changes = {
      productos: readRows(sheets.Productos).map(withoutIndex),
      lotes: readRows(sheets.Lotes).map(withoutIndex),
      configuracion: readRows(sheets.Configuracion).map(withoutIndex),
    };

    const now = new Date().toISOString();
    registerDevice(sheets, request.dispositivo, now);
    return { ok: true, aplicadas, duplicadas, avisos, cambios: changes, ahora: now };
  } finally {
    lock.releaseLock();
  }
}

// Aplica una operación a la hoja. Devuelve un texto de aviso si no se pudo aplicar del todo.
function applyOperation(sheets, op) {
  const date = op.fecha;
  switch (op.tipo) {
    case 'crear':
      return createIfMissing(op.entidad === 'producto' ? sheets.Productos : sheets.Lotes, op);
    case 'editar':
      return editFields(op.entidad === 'producto' ? sheets.Productos : sheets.Lotes, op.entidad_id, op.cambio, date);
    case 'consumir':
    case 'reponer':
      return incrementQuantity(sheets.Lotes, op.entidad_id, Number(op.cambio.cantidad), date);
    case 'borrar':
      return editFields(op.entidad === 'producto' ? sheets.Productos : sheets.Lotes, op.entidad_id, { borrado: true }, date, { forzar: true });
    default:
      return `tipo desconocido ${op.tipo}`;
  }
}

// Alta: si ya existe el id, no se duplica (la operación se considera aplicada igualmente).
function createIfMissing(sheet, op) {
  const existing = readRows(sheet).find((f) => f.id === op.entidad_id);
  if (existing) return null;
  const data = Object.assign({}, op.cambio, { id: op.entidad_id, actualizado: op.fecha, borrado: false });
  if (sheet.getName() === 'Lotes') data.revisar = 'no';
  sheet.appendRow(rowFrom(COLUMNS[sheet.getName()], data));
  return null;
}

// Edición de campos: gana el registro con "actualizado" más reciente. Un borrado no se revierte.
function editFields(sheet, id, change, date, options) {
  const row = findRow(sheet, id);
  if (!row) return 'no existe en la hoja';
  if (row.borrado === 'sí' && !(options && options.forzar)) return null;
  if (!options?.forzar && date < row.actualizado) return null;
  const actualizado = [row.actualizado, date].sort().pop();
  const newItem = Object.assign({}, row, change, { actualizado });
  writeRow(sheet, row._fila, newItem);
  return null;
}

// Consumo y reposición son incrementos: se suman. Si queda negativo, se fija a 0 y se marca para revisar.
function incrementQuantity(sheet, id, delta, date) {
  const row = findRow(sheet, id);
  if (!row) return 'lote no existe en la hoja';
  let quantity = Number(row.cantidad) + delta;
  let revisar = row.revisar;
  if (quantity < 0) {
    quantity = 0;
    revisar = 'sí';
  }
  const actualizado = [row.actualizado, date].sort().pop();
  writeRow(sheet, row._fila, Object.assign({}, row, { cantidad: quantity, revisar, actualizado }));
  return null;
}

// La configuración no tiene operaciones: gana el valor con "actualizado" más reciente.
function applySettings(sheets, rows) {
  for (const incoming of rows) {
    const row = findRow(sheets.Configuracion, incoming.clave);
    if (!row) {
      sheets.Configuracion.appendRow(rowFrom(COLUMNS.Configuracion, incoming));
    } else if (incoming.actualizado > row.actualizado) {
      writeRow(sheets.Configuracion, row._fila, Object.assign({}, row, incoming));
    }
  }
}

function registerDevice(sheets, device, now) {
  const row = findRow(sheets.Dispositivos, device, 'dispositivo');
  const data = { dispositivo: device, ultima_sincronizacion: now };
  if (row) writeRow(sheets.Dispositivos, row._fila, Object.assign({}, row, data));
  else sheets.Dispositivos.appendRow(rowFrom(COLUMNS.Dispositivos, data));
}

// ---------- Fotos ----------

// Guarda la foto en Drive. Si ya existe un fichero con ese nombre, devuelve su id (idempotente).
function uploadPhoto(request) {
  const name = String(request.nombre || '').replace(/[^\w.-]/g, '_');
  if (!name) throw new Error('Falta el nombre de la foto');
  const folder = photoFolder();
  const existingList = folder.getFilesByName(name);
  if (existingList.hasNext()) return { ok: true, id: existingList.next().getId() };
  const blob = Utilities.newBlob(Utilities.base64Decode(request.dato), request.tipo || 'image/jpeg', name);
  return { ok: true, id: folder.createFile(blob).getId() };
}

function photoFolder() {
  const folders = DriveApp.getFoldersByName(PHOTOS_FOLDER);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTOS_FOLDER);
}

// ---------- Hojas ----------

function openSheets() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {};
  for (const name of Object.keys(COLUMNS)) {
    let sheet = book.getSheetByName(name);
    if (!sheet) {
      sheet = book.insertSheet(name);
      // Todo como texto: si no, Sheets convierte "2026-11-15" y las marcas de tiempo en fechas.
      sheet.getRange(1, 1, sheet.getMaxRows(), COLUMNS[name].length).setNumberFormat('@');
      sheet.appendRow(COLUMNS[name]);
    } else {
      addMissingHeaders(sheet, COLUMNS[name]);
    }
    sheets[name] = sheet;
  }
  return sheets;
}

// Devuelve las filas como objetos. _fila es el número de fila real en la hoja.
function readRows(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(String);
  return values.slice(1).map((row, i) => {
    const object = { _fila: i + 2 };
    header.forEach((name, j) => {
      object[name] = normalizeValue(row[j], name);
    });
    return object;
  });
}

function normalizeValue(value, field) {
  if (value instanceof Date) {
    return field === 'caducidad'
      ? Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd')
      : value.toISOString();
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function findRow(sheet, value, field) {
  const key = field || 'id';
  return readRows(sheet).find((f) => f[key] === value) || null;
}

function rowFrom(columns, data) {
  return columns.map((c) => {
    const v = data[c];
    if (v === true) return 'sí';
    if (v === false) return 'no';
    return v === undefined || v === null ? '' : String(v);
  });
}

function writeRow(sheet, row, data) {
  const columns = COLUMNS[sheet.getName()];
  sheet.getRange(row, 1, 1, columns.length).setValues([rowFrom(columns, data)]);
}

function withoutIndex(row) {
  const backup = Object.assign({}, row);
  delete backup._fila;
  if (backup.borrado !== undefined) backup.borrado = backup.borrado === 'sí';
  return backup;
}

// Una hoja creada antes puede no tener columnas nuevas: se añaden al final de la cabecera.
// Las filas existentes quedan con esas celdas vacías; no se borra ni se mueve nada.
function addMissingHeaders(sheet, columns) {
  const actuales = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  columns.forEach((name) => {
    if (actuales.indexOf(name) !== -1) return;
    const column = actuales.filter((c) => c !== '').length + 1;
    sheet.getRange(1, column).setNumberFormat('@').setValue(name);
    actuales.push(name);
  });
}
