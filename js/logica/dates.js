// Expiry dates: YYYY-MM-DD text. "Today" is the day in Madrid.
import { t } from './idioma.js';

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

// Days from "since" to "until" (negative if "until" is earlier).
export function daysBetween(since, until) {
  return Math.round((toUTC(until) - toUTC(since)) / DAY_MS);
}

export function formatDate(iso) {
  if (!isISODate(iso)) return iso ?? '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// Length in years, months and days (approximate: a year of 365 days, a month of 30).
// The two largest units that are not zero are shown: "2 years and 23 days", "3 months and 10 days".
export function readableDuration(days) {
  const n = Math.abs(days);
  const years = Math.floor(n / 365);
  const rest = n % 365;
  const months = Math.floor(rest / 30);
  const looseDays = rest % 30;
  const p = (figure, singular, plural) => `${figure} ${t(figure === 1 ? singular : plural)}`;
  const parts = [
    years > 0 ? p(years, 'fecha.ano', 'fecha.anos') : null,
    months > 0 ? p(months, 'fecha.mes', 'fecha.meses') : null,
    looseDays > 0 ? p(looseDays, 'fecha.dia', 'fecha.dias') : null,
  ].filter(Boolean);
  if (parts.length === 0) return p(0, 'fecha.dia', 'fecha.dias');
  return parts.slice(0, 2).join(` ${t('fecha.y')} `);
}

export function describeExpiry(days) {
  if (days < -1) return t('fecha.caducado_hace', { duracion: readableDuration(days) });
  if (days === -1) return t('fecha.caduco_ayer');
  if (days === 0) return t('fecha.caduca_hoy');
  if (days === 1) return t('fecha.caduca_manana');
  return t('fecha.caduca_en', { duracion: readableDuration(days) });
}

// Date typed by hand (number keypad). While typing, the slashes are added by themselves:
// "01032027" → "01/03/2027". If written with dashes (YYYY-MM-DD), it is kept as is.
export function formatDateInput(text) {
  const original = String(text ?? '');
  if (original.includes('-')) return original.slice(0, 10);
  const digits = original.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// Converts what was typed to YYYY-MM-DD. Accepts DD/MM/AAAA, DD/MM/AA, DDMMAAAA and AAAA-MM-DD.
// Returns null if it is not a real date (e.g. 31/02).
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
