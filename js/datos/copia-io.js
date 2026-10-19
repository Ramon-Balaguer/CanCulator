// Entrada y salida de copias JSON en el navegador. La lógica está en js/logica/copia.js.
import { construirCopia, fusionarCopia, validarCopia } from '../logica/copia.js';
import { TABLAS, peticion, transaccion } from './db.js';

const bytesABase64 = (buffer) => {
  let binario = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
};

const base64AArrayBuffer = (base64) => {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
};

export async function exportarCopia(db, dispositivo) {
  const { productos, lotes, configuracion, operaciones, fotos } = await transaccion(
    db,
    [TABLAS.productos, TABLAS.lotes, TABLAS.configuracion, TABLAS.operaciones, TABLAS.fotos],
    'readonly',
    async (tx) => ({
      productos: await peticion(tx.objectStore(TABLAS.productos).getAll()),
      lotes: await peticion(tx.objectStore(TABLAS.lotes).getAll()),
      configuracion: await peticion(tx.objectStore(TABLAS.configuracion).getAll()),
      operaciones: await peticion(tx.objectStore(TABLAS.operaciones).getAll()),
      fotos: await peticion(tx.objectStore(TABLAS.fotos).getAll()),
    }),
  );
  const fotosBase64 = fotos.map((foto) => ({
    id: foto.id,
    creada: foto.creada,
    tipo: foto.tipo,
    dato: bytesABase64(foto.bytes),
  }));
  const copia = construirCopia({ dispositivo, productos, lotes, configuracion, fotos: fotosBase64 });
  // Las operaciones pendientes van también, para no perder la cola si se restaura en otro móvil.
  copia.operaciones_pendientes = operaciones;
  return {
    nombre: `inventario-${copia.exportado.slice(0, 10)}.json`,
    texto: JSON.stringify(copia, null, 2),
  };
}

// Lee un fichero, lo valida y lo fusiona con lo que hay en el móvil. Devuelve el resumen.
export async function importarCopia(db, fichero) {
  const texto = await fichero.text();
  let copia;
  try {
    copia = JSON.parse(texto);
  } catch {
    throw new Error('El fichero no es un JSON válido');
  }
  validarCopia(copia);
  const fotosNuevas = (copia.fotos ?? []).map((f) => ({
    id: f.id,
    creada: f.creada,
    tipo: f.tipo ?? 'image/jpeg',
    bytes: base64AArrayBuffer(f.dato),
  }));

  return transaccion(db, Object.values(TABLAS), 'readwrite', async (tx) => {
    const local = {
      productos: await peticion(tx.objectStore(TABLAS.productos).getAll()),
      lotes: await peticion(tx.objectStore(TABLAS.lotes).getAll()),
      configuracion: await peticion(tx.objectStore(TABLAS.configuracion).getAll()),
      fotos: await peticion(tx.objectStore(TABLAS.fotos).getAll()),
    };
    const fusion = fusionarCopia(local, copia);
    const escribir = (tabla, registros) => {
      const almacen = tx.objectStore(tabla);
      for (const r of registros) almacen.put(r);
    };
    escribir(TABLAS.productos, fusion.productos);
    escribir(TABLAS.lotes, fusion.lotes);
    escribir(TABLAS.configuracion, fusion.configuracion);
    const fotosLocales = new Set(local.fotos.map((f) => f.id));
    escribir(TABLAS.fotos, fotosNuevas.filter((f) => !fotosLocales.has(f.id)));
    return fusion.resumen;
  });
}

export function descargarTexto({ nombre, texto }) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
