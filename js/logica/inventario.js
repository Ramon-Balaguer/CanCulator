// Cálculos sobre productos y lotes. El stock no se guarda: es la suma de los lotes no borrados.
import { diasEntre } from './fechas.js';

export const activo = (registro) => !!registro && !registro.borrado;

const comparador = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compararTexto = (a, b) => comparador.compare(a ?? '', b ?? '');

// Para buscar sin importar mayúsculas, tildes ni espacios sobrantes.
export function claveTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function idCorto(id) {
  return String(id ?? '').slice(0, 6);
}

export function mapaPorId(registros) {
  return new Map(registros.map((r) => [r.id, r]));
}

export function lotesDeProducto(productoId, lotes) {
  return lotes.filter((l) => activo(l) && l.producto_id === productoId);
}

export function stockDe(productoId, lotes) {
  return lotesDeProducto(productoId, lotes).reduce((suma, l) => suma + l.cantidad, 0);
}

// Orden por caducidad ascendente; a igual fecha, el lote con menos unidades primero
// (se acaba antes) y, por último, el id para que el orden sea estable.
export function compararCaducidad(a, b) {
  return (a.caducidad ?? '9999-99-99').localeCompare(b.caducidad ?? '9999-99-99')
    || a.cantidad - b.cantidad
    || a.id.localeCompare(b.id);
}

// Lotes que se ven en la app: no borrados, con unidades y de un producto no borrado.
export function lotesVisibles(lotes, productos) {
  const porId = mapaPorId(productos);
  return lotes
    .filter((l) => activo(l) && l.cantidad > 0 && activo(porId.get(l.producto_id)))
    .sort(compararCaducidad);
}

export function estadoCaducidad(caducidad, hoy, diasPronto) {
  const dias = diasEntre(hoy, caducidad);
  if (dias < 0) return 'caducado';
  if (dias <= diasPronto) return 'pronto';
  return 'ok';
}

// Lotes de un producto para consumir: el primero es el que caduca antes (el propuesto).
export function lotesParaConsumir(productoId, lotes) {
  return lotesDeProducto(productoId, lotes)
    .filter((l) => l.cantidad > 0)
    .sort(compararCaducidad);
}

// Una fila por producto: total de unidades, próxima caducidad y ubicaciones.
// Primero los que tienen unidades, por nombre; al final los que están a 0.
export function resumenStock(productos, lotes) {
  const visibles = lotesVisibles(lotes, productos);
  return productos
    .filter(activo)
    .map((producto) => {
      const suyos = visibles.filter((l) => l.producto_id === producto.id);
      return {
        producto,
        total: suyos.reduce((suma, l) => suma + l.cantidad, 0),
        proximaCaducidad: suyos[0]?.caducidad ?? null,
        ubicaciones: [...new Set(suyos.map((l) => l.ubicacion))],
      };
    })
    .sort((a, b) => (b.total > 0) - (a.total > 0) || compararTexto(a.producto.nombre, b.producto.nombre));
}

export function filtrarResumen(resumen, { categoria = '', ubicacion = '' } = {}) {
  return resumen.filter((fila) =>
    (!categoria || fila.producto.categoria === categoria)
    && (!ubicacion || fila.ubicaciones.includes(ubicacion)));
}

// Productos con stock por debajo de su mínimo (solo si el mínimo es mayor que 0).
export function aReponer(productos, lotes) {
  return productos
    .filter((p) => activo(p) && p.stock_minimo > 0)
    .map((producto) => {
      const stock = stockDe(producto.id, lotes);
      return { producto, stock, falta: producto.stock_minimo - stock };
    })
    .filter((fila) => fila.falta > 0)
    .sort((a, b) => b.falta - a.falta || compararTexto(a.producto.nombre, b.producto.nombre));
}

export function buscarProductoPorCodigo(productos, codigo) {
  if (!codigo) return null;
  return productos.find((p) => activo(p) && p.codigo_barras === codigo) ?? null;
}

export function buscarProductoPorNombre(productos, nombre) {
  const clave = claveTexto(nombre);
  if (!clave) return null;
  return productos.find((p) => activo(p) && claveTexto(p.nombre) === clave) ?? null;
}

// Un lote es "el mismo" si coincide producto, caducidad y ubicación.
export function buscarLoteIgual(lotes, { producto_id, caducidad, ubicacion }) {
  return lotes.find((l) => activo(l)
    && l.producto_id === producto_id
    && l.caducidad === caducidad
    && l.ubicacion === ubicacion) ?? null;
}

// Sustituye por id los registros que han cambiado. Devuelve una lista nueva.
export function sustituirPorId(registros, cambiados, clave = 'id') {
  if (!cambiados?.length) return registros;
  const nuevos = new Map(cambiados.map((r) => [r[clave], r]));
  const resultado = registros.map((r) => nuevos.get(r[clave]) ?? r);
  const existentes = new Set(registros.map((r) => r[clave]));
  for (const r of cambiados) if (!existentes.has(r[clave])) resultado.push(r);
  return resultado;
}
