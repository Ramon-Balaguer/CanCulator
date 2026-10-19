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
