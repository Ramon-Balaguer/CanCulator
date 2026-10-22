// Inventory of the house: synchronization server (Google Apps Script).
// Pasted into the Apps Script project bound to the shared sheet and deployed as
// web application (run as: me; access: anyone). See docs/apps-script.md.
//
// Sheet tabs: Productos, Lotes, Configuracion, Dispositivos, Aplicadas.
// The operations (Operaciones) exist only on the phone.

const SERVER_VERSION = '1';
const PHOTOS_FOLDER = 'inventario-fotos';
const TIME_ZONE = 'Europe/Madrid';

const COLUMNS = {
  Productos: ['id', 'nombre', 'categoria', 'codigo_barras', 'stock_minimo', 'actualizado', 'borrado', 'kcal_100g', 'peso_bote_g', 'observaciones', 'foto_id'],
  Lotes: ['id', 'producto_id', 'cantidad', 'caducidad', 'ubicacion', 'observaciones', 'foto_id', 'revisar', 'actualizado', 'borrado'],
  Configuracion: ['clave', 'valor', 'actualizado'],
  Dispositivos: ['dispositivo', 'ultima_sincronizacion'],
  Aplicadas: ['id', 'dispositivo', 'aplicada'],
};

// ---------- HTTP entry ----------

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

// ---------- Sync ----------

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

    // All rows are returned, not only those after "since": "updated" stores the
    // date of the phone that made the change (it resolves conflicts), and a change made
    // without filter
    // Filtering by it would leave that other phone without the change. A household's volume is small.
    // "since" stays in the request in case the server date is separated later.
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

// Applies an operation to the sheet. Returns a warning text if it could not be fully applied.
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

// Creation: if the id already exists, it is not duplicated (the operation still counts as applied).
function createIfMissing(sheet, op) {
  const existing = readRows(sheet).find((f) => f.id === op.entidad_id);
  if (existing) return null;
  const data = Object.assign({}, op.cambio, { id: op.entidad_id, actualizado: op.fecha, borrado: false });
  if (sheet.getName() === 'Lotes') data.revisar = 'no';
  sheet.appendRow(rowFrom(COLUMNS[sheet.getName()], data));
  return null;
}

// Field edit: the record with the most recent "updated" wins. A delete is not reverted.
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

// Consumption and restock are increments: they add up. If it becomes negative, it is set to 0 and marked for review.
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

// Settings have no operations: the value with the most recent "updated" wins.
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

// ---------- Photos ----------

// Stores the photo in Drive. If a file with that name already exists, it returns its id (idempotent).
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

// ---------- Sheets ----------

function openSheets() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {};
  for (const name of Object.keys(COLUMNS)) {
    let sheet = book.getSheetByName(name);
    if (!sheet) {
      sheet = book.insertSheet(name);
      // Everything as text: otherwise Sheets converts "2026-11-15" and timestamps into dates.
      sheet.getRange(1, 1, sheet.getMaxRows(), COLUMNS[name].length).setNumberFormat('@');
      sheet.appendRow(COLUMNS[name]);
    } else {
      addMissingHeaders(sheet, COLUMNS[name]);
    }
    sheets[name] = sheet;
  }
  return sheets;
}

// Returns the rows as objects. _fila is the real row number in the sheet.
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

// A sheet created before may not have new columns: they are added at the end of the header.
// Existing rows keep those cells empty; nothing is deleted or moved.
function addMissingHeaders(sheet, columns) {
  const actuales = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  columns.forEach((name) => {
    if (actuales.indexOf(name) !== -1) return;
    const column = actuales.filter((c) => c !== '').length + 1;
    sheet.getRange(1, column).setNumberFormat('@').setValue(name);
    actuales.push(name);
  });
}
