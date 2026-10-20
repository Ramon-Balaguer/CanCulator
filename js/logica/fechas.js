// Fechas de caducidad: texto YYYY-MM-DD. "Hoy" es el día en Madrid.

export const ZONA = 'Europe/Madrid';
const DIA_MS = 86_400_000;

const formatoDia = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function hoyEnMadrid(ahora = new Date()) {
  const partes = Object.fromEntries(formatoDia.formatToParts(ahora).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

function aUTC(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function esFechaISO(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(aUTC(texto));
  return fecha.toISOString().slice(0, 10) === texto;
}

// Días de "desde" a "hasta" (negativo si "hasta" es anterior).
export function diasEntre(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / DIA_MS);
}

export function formatearFecha(iso) {
  if (!esFechaISO(iso)) return iso ?? '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function describirCaducidad(dias) {
  if (dias < -1) return `Caducado hace ${-dias} días`;
  if (dias === -1) return 'Caducó ayer';
  if (dias === 0) return 'Caduca hoy';
  if (dias === 1) return 'Caduca mañana';
  return `Caduca en ${dias} días`;
}

// Fecha escrita a mano (teclado numérico). Mientras se escribe, pone las barras solas:
// "01032027" → "01/03/2027". Si se escribe con guiones (AAAA-MM-DD), se deja tal cual.
export function formatearEntradaFecha(texto) {
  const original = String(texto ?? '');
  if (original.includes('-')) return original.slice(0, 10);
  const digitos = original.replace(/\D/g, '').slice(0, 8);
  if (digitos.length > 4) return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
  if (digitos.length > 2) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return digitos;
}

// Convierte lo escrito a YYYY-MM-DD. Acepta DD/MM/AAAA, DD/MM/AA, DDMMAAAA y AAAA-MM-DD.
// Devuelve null si no es una fecha real (p. ej. 31/02).
export function leerFechaEscrita(texto) {
  const t = String(texto ?? '').trim();
  let anio;
  let mes;
  let dia;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    [, anio, mes, dia] = m;
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t))) {
    [, dia, mes, anio] = m;
    if (anio.length === 2) anio = `20${anio}`;
  } else if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) {
    [, dia, mes, anio] = m;
  } else {
    return null;
  }
  const iso = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  return esFechaISO(iso) ? iso : null;
}
