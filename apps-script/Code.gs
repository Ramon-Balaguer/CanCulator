// Inventario de casa: servidor de sincronización (Google Apps Script).
// Se pega en el proyecto de Apps Script ligado a la hoja compartida y se despliega como
// aplicación web (ejecutar como: yo; acceso: cualquier usuario). Ver docs/apps-script.md.
//
// Pestañas de la hoja: Productos, Lotes, Configuracion, Dispositivos, Aplicadas.
// Las operaciones (Operaciones) solo existen en el móvil.

const VERSION_SERVIDOR = '1';
const CARPETA_FOTOS = 'inventario-fotos';
const ZONA = 'Europe/Madrid';

const COLUMNAS = {
  Productos: ['id', 'nombre', 'categoria', 'codigo_barras', 'stock_minimo', 'actualizado', 'borrado'],
  Lotes: ['id', 'producto_id', 'cantidad', 'caducidad', 'ubicacion', 'observaciones', 'foto_id', 'revisar', 'actualizado', 'borrado'],
  Configuracion: ['clave', 'valor', 'actualizado'],
  Dispositivos: ['dispositivo', 'ultima_sincronizacion'],
  Aplicadas: ['id', 'dispositivo', 'aplicada'],
};

// ---------- Entrada HTTP ----------

function doPost(e) {
  try {
    const peticion = JSON.parse(e.postData.contents);
    verificarToken(peticion.token);
    let respuesta;
    if (peticion.accion === 'ping') {
      respuesta = { ok: true, version: VERSION_SERVIDOR };
    } else if (peticion.accion === 'sincronizar') {
      respuesta = sincronizar(peticion);
    } else if (peticion.accion === 'foto') {
      respuesta = subirFoto(peticion);
    } else {
      throw new Error('Acción desconocida');
    }
    return salida(respuesta);
  } catch (error) {
    return salida({ ok: false, error: error.message });
  }
}

function salida(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function verificarToken(token) {
  const esperado = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!esperado) throw new Error('El script no tiene token configurado');
  if (token !== esperado) throw new Error('Token no válido');
}

// ---------- Sincronización ----------

function sincronizar(peticion) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const hojas = abrirHojas();
    const yaAplicadas = new Set(leerFilas(hojas.Aplicadas).map((f) => f.id));
    const avisos = [];
    const aplicadas = [];
    const duplicadas = [];

    for (const operacion of peticion.operaciones || []) {
      if (yaAplicadas.has(operacion.id)) {
        duplicadas.push(operacion.id);
        continue;
      }
      const aviso = aplicarOperacion(hojas, operacion);
      if (aviso) avisos.push(`${operacion.id}: ${aviso}`);
      hojas.Aplicadas.appendRow(filaDesde(COLUMNAS.Aplicadas, {
        id: operacion.id,
        dispositivo: peticion.dispositivo,
        aplicada: new Date().toISOString(),
      }));
      yaAplicadas.add(operacion.id);
      aplicadas.push(operacion.id);
    }

    aplicarConfiguracion(hojas, peticion.configuracion || []);

    // Se devuelven todas las filas, no solo las posteriores a "desde": "actualizado" guarda la
    // fecha del móvil que hizo el cambio (sirve para resolver conflictos), y un cambio hecho
    // sin conexión puede tener una fecha anterior a la última sincronización de otro móvil.
    // Filtrar por ella dejaría a ese otro móvil sin el cambio. El volumen de una casa es pequeño.
    // "desde" queda en la petición por si más adelante se separa la fecha de servidor.
    const cambios = {
      productos: leerFilas(hojas.Productos).map(sinIndice),
      lotes: leerFilas(hojas.Lotes).map(sinIndice),
      configuracion: leerFilas(hojas.Configuracion).map(sinIndice),
    };

    const ahora = new Date().toISOString();
    registrarDispositivo(hojas, peticion.dispositivo, ahora);
    return { ok: true, aplicadas, duplicadas, avisos, cambios, ahora };
  } finally {
    lock.releaseLock();
  }
}

// Aplica una operación a la hoja. Devuelve un texto de aviso si no se pudo aplicar del todo.
function aplicarOperacion(hojas, op) {
  const fecha = op.fecha;
  switch (op.tipo) {
    case 'crear':
      return crearSiFalta(op.entidad === 'producto' ? hojas.Productos : hojas.Lotes, op);
    case 'editar':
      return editarCampos(op.entidad === 'producto' ? hojas.Productos : hojas.Lotes, op.entidad_id, op.cambio, fecha);
    case 'consumir':
    case 'reponer':
      return incrementarCantidad(hojas.Lotes, op.entidad_id, Number(op.cambio.cantidad), fecha);
    case 'borrar':
      return editarCampos(op.entidad === 'producto' ? hojas.Productos : hojas.Lotes, op.entidad_id, { borrado: true }, fecha, { forzar: true });
    default:
      return `tipo desconocido ${op.tipo}`;
  }
}

// Alta: si ya existe el id, no se duplica (la operación se considera aplicada igualmente).
function crearSiFalta(hoja, op) {
  const existente = leerFilas(hoja).find((f) => f.id === op.entidad_id);
  if (existente) return null;
  const datos = Object.assign({}, op.cambio, { id: op.entidad_id, actualizado: op.fecha, borrado: false });
  if (hoja.getName() === 'Lotes') datos.revisar = 'no';
  hoja.appendRow(filaDesde(COLUMNAS[hoja.getName()], datos));
  return null;
}

// Edición de campos: gana el registro con "actualizado" más reciente. Un borrado no se revierte.
function editarCampos(hoja, id, cambio, fecha, opciones) {
  const fila = buscarFila(hoja, id);
  if (!fila) return 'no existe en la hoja';
  if (fila.borrado === 'sí' && !(opciones && opciones.forzar)) return null;
  if (!opciones?.forzar && fecha < fila.actualizado) return null;
  const actualizado = [fila.actualizado, fecha].sort().pop();
  const nuevo = Object.assign({}, fila, cambio, { actualizado });
  escribirFila(hoja, fila._fila, nuevo);
  return null;
}

// Consumo y reposición son incrementos: se suman. Si queda negativo, se fija a 0 y se marca para revisar.
function incrementarCantidad(hoja, id, delta, fecha) {
  const fila = buscarFila(hoja, id);
  if (!fila) return 'lote no existe en la hoja';
  let cantidad = Number(fila.cantidad) + delta;
  let revisar = fila.revisar;
  if (cantidad < 0) {
    cantidad = 0;
    revisar = 'sí';
  }
  const actualizado = [fila.actualizado, fecha].sort().pop();
  escribirFila(hoja, fila._fila, Object.assign({}, fila, { cantidad, revisar, actualizado }));
  return null;
}

// La configuración no tiene operaciones: gana el valor con "actualizado" más reciente.
function aplicarConfiguracion(hojas, filas) {
  for (const entrante of filas) {
    const fila = buscarFila(hojas.Configuracion, entrante.clave);
    if (!fila) {
      hojas.Configuracion.appendRow(filaDesde(COLUMNAS.Configuracion, entrante));
    } else if (entrante.actualizado > fila.actualizado) {
      escribirFila(hojas.Configuracion, fila._fila, Object.assign({}, fila, entrante));
    }
  }
}

function registrarDispositivo(hojas, dispositivo, ahora) {
  const fila = buscarFila(hojas.Dispositivos, dispositivo, 'dispositivo');
  const datos = { dispositivo, ultima_sincronizacion: ahora };
  if (fila) escribirFila(hojas.Dispositivos, fila._fila, Object.assign({}, fila, datos));
  else hojas.Dispositivos.appendRow(filaDesde(COLUMNAS.Dispositivos, datos));
}

// ---------- Fotos ----------

// Guarda la foto en Drive. Si ya existe un fichero con ese nombre, devuelve su id (idempotente).
function subirFoto(peticion) {
  const nombre = String(peticion.nombre || '').replace(/[^\w.-]/g, '_');
  if (!nombre) throw new Error('Falta el nombre de la foto');
  const carpeta = carpetaFotos();
  const existentes = carpeta.getFilesByName(nombre);
  if (existentes.hasNext()) return { ok: true, id: existentes.next().getId() };
  const blob = Utilities.newBlob(Utilities.base64Decode(peticion.dato), peticion.tipo || 'image/jpeg', nombre);
  return { ok: true, id: carpeta.createFile(blob).getId() };
}

function carpetaFotos() {
  const carpetas = DriveApp.getFoldersByName(CARPETA_FOTOS);
  return carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_FOTOS);
}

// ---------- Hojas ----------

function abrirHojas() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hojas = {};
  for (const nombre of Object.keys(COLUMNAS)) {
    let hoja = libro.getSheetByName(nombre);
    if (!hoja) {
      hoja = libro.insertSheet(nombre);
      // Todo como texto: si no, Sheets convierte "2026-11-15" y las marcas de tiempo en fechas.
      hoja.getRange(1, 1, hoja.getMaxRows(), COLUMNAS[nombre].length).setNumberFormat('@');
      hoja.appendRow(COLUMNAS[nombre]);
    }
    hojas[nombre] = hoja;
  }
  return hojas;
}

// Devuelve las filas como objetos. _fila es el número de fila real en la hoja.
function leerFilas(hoja) {
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];
  const cabecera = valores[0].map(String);
  return valores.slice(1).map((fila, i) => {
    const objeto = { _fila: i + 2 };
    cabecera.forEach((nombre, j) => {
      objeto[nombre] = normalizarValor(fila[j], nombre);
    });
    return objeto;
  });
}

function normalizarValor(valor, campo) {
  if (valor instanceof Date) {
    return campo === 'caducidad'
      ? Utilities.formatDate(valor, ZONA, 'yyyy-MM-dd')
      : valor.toISOString();
  }
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

function buscarFila(hoja, valor, campo) {
  const clave = campo || 'id';
  return leerFilas(hoja).find((f) => f[clave] === valor) || null;
}

function filaDesde(columnas, datos) {
  return columnas.map((c) => {
    const v = datos[c];
    if (v === true) return 'sí';
    if (v === false) return 'no';
    return v === undefined || v === null ? '' : String(v);
  });
}

function escribirFila(hoja, fila, datos) {
  const columnas = COLUMNAS[hoja.getName()];
  hoja.getRange(fila, 1, 1, columnas.length).setValues([filaDesde(columnas, datos)]);
}

function sinIndice(fila) {
  const copia = Object.assign({}, fila);
  delete copia._fila;
  if (copia.borrado !== undefined) copia.borrado = copia.borrado === 'sí';
  return copia;
}
