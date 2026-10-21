// Fechas de caducidad: texto YYYY-MM-DD. "Hoy" es el día en Madrid.

export const TIME_ZONE = 'Europe/Madrid';
const DAY_MS = 86_400_000;

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInMadrid(now = new Date()) {
  const parts = Object.fromEntries(dayFormat.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUTC(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function isISODate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(toUTC(text));
  return date.toISOString().slice(0, 10) === text;
}

// Días de "desde" a "hasta" (negativo si "hasta" es anterior).
export function daysBetween(since, until) {
  return Math.round((toUTC(until) - toUTC(since)) / DAY_MS);
}

export function formatDate(iso) {
  if (!isISODate(iso)) return iso ?? '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// Duración en años, meses y días (aproximada: año de 365 días, mes de 30).
// Se muestran las dos unidades mayores que no sean cero: "2 años y 23 días", "3 meses y 10 días".
export function readableDuration(days) {
  const n = Math.abs(days);
  const years = Math.floor(n / 365);
  const rest = n % 365;
  const months = Math.floor(rest / 30);
  const looseDays = rest % 30;
  const p = (figure, singular, plural) => `${figure} ${figure === 1 ? singular : plural}`;
  const parts = [
    years > 0 ? p(years, 'año', 'años') : null,
    months > 0 ? p(months, 'mes', 'meses') : null,
    looseDays > 0 ? p(looseDays, 'día', 'días') : null,
  ].filter(Boolean);
  if (parts.length === 0) return p(0, 'día', 'días');
  return parts.slice(0, 2).join(' y ');
}

export function describeExpiry(days) {
  if (days < -1) return `Caducado hace ${readableDuration(days)}`;
  if (days === -1) return 'Caducó ayer';
  if (days === 0) return 'Caduca hoy';
  if (days === 1) return 'Caduca mañana';
  return `Caduca en ${readableDuration(days)}`;
}

// Fecha escrita a mano (teclado numérico). Mientras se escribe, pone las barras solas:
// "01032027" → "01/03/2027". Si se escribe con guiones (AAAA-MM-DD), se deja tal cual.
export function formatDateInput(text) {
  const original = String(text ?? '');
  if (original.includes('-')) return original.slice(0, 10);
  const digits = original.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// Convierte lo escrito a YYYY-MM-DD. Acepta DD/MM/AAAA, DD/MM/AA, DDMMAAAA y AAAA-MM-DD.
// Devuelve null si no es una fecha real (p. ej. 31/02).
export function parseTypedDate(text) {
  const t = String(text ?? '').trim();
  let year;
  let month;
  let day;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) {
    [, year, month, day] = m;
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(t))) {
    [, day, month, year] = m;
    if (year.length === 2) year = `20${year}`;
  } else if ((m = /^(\d{2})(\d{2})(\d{4})$/.exec(t))) {
    [, day, month, year] = m;
  } else {
    return null;
  }
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return isISODate(iso) ? iso : null;
}
