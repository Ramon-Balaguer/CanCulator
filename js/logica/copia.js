// Copia JSON del inventario: construir, validar y fusionar. Sin acceso a IndexedDB.
// La fusión sigue la misma regla que la sincronización: gana el registro con "actualizado" más reciente.

export const VERSION_COPIA = 1;

export function construirCopia({ dispositivo, productos, lotes, configuracion, fotos = [], fecha = new Date().toISOString() }) {
  return {
    formato: 'inventario-casa',
    version: VERSION_COPIA,
    exportado: fecha,
    dispositivo,
    productos,
    lotes,
    configuracion,
    // Las fotos van en base64 para que el JSON sea autocontenido.
    fotos,
  };
}

const LISTAS = ['productos', 'lotes', 'configuracion', 'fotos'];

export function validarCopia(copia) {
  if (!copia || typeof copia !== 'object') throw new Error('El fichero no es una copia válida');
  if (copia.formato !== 'inventario-casa') throw new Error('El fichero no es una copia de Inventario de casa');
  if (!Number.isInteger(copia.version) || copia.version > VERSION_COPIA) {
    throw new Error(`La copia es de una versión más nueva (${copia.version}). Actualiza la app.`);
  }
  for (const lista of LISTAS) {
    if (copia[lista] !== undefined && !Array.isArray(copia[lista])) {
      throw new Error(`La copia tiene un campo "${lista}" que no es una lista`);
    }
  }
  for (const producto of copia.productos ?? []) {
    if (!producto.id || typeof producto.nombre !== 'string') throw new Error('Hay un producto sin id o sin nombre');
  }
  for (const lote of copia.lotes ?? []) {
    if (!lote.id || !lote.producto_id) throw new Error('Hay un lote sin id o sin producto');
    if (!Number.isInteger(lote.cantidad) || lote.cantidad < 0) throw new Error(`Cantidad no válida en el lote ${lote.id}`);
  }
  return copia;
}

// Fusiona un registro local con uno de la copia. Por id; si ambos existen, gana el más reciente.
// Empate: el local, para no cambiar nada sin motivo.
function fusionarLista(local, entrante) {
  const mapa = new Map(local.map((r) => [r.id, r]));
  let nuevos = 0;
  let actualizados = 0;
  for (const r of entrante) {
    const actual = mapa.get(r.id);
    if (!actual) {
      mapa.set(r.id, r);
      nuevos++;
    } else if ((r.actualizado ?? '') > (actual.actualizado ?? '')) {
      mapa.set(r.id, r);
      actualizados++;
    }
  }
  return { registros: [...mapa.values()], nuevos, actualizados };
}

// Devuelve el resultado de fusionar sin tocar nada. "configuracion" no tiene fecha: la copia
// sobrescribe las claves que trae.
export function fusionarCopia(local, copia) {
  const productos = fusionarLista(local.productos, copia.productos ?? []);
  const lotes = fusionarLista(local.lotes, copia.lotes ?? []);
  const fotos = fusionarLista(local.fotos ?? [], copia.fotos ?? []);

  const configuracion = new Map((local.configuracion ?? []).map((c) => [c.clave, c]));
  for (const c of copia.configuracion ?? []) configuracion.set(c.clave, c);

  return {
    productos: productos.registros,
    lotes: lotes.registros,
    fotos: fotos.registros,
    configuracion: [...configuracion.values()],
    resumen: {
      productos: productos.nuevos + productos.actualizados,
      lotes: lotes.nuevos + lotes.actualizados,
      fotos: fotos.nuevos,
    },
  };
}
