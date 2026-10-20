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

// Duración en años, meses y días (aproximada: año de 365 días, mes de 30).
// Se muestran las dos unidades mayores que no sean cero: "2 años y 23 días", "3 meses y 10 días".
export function duracionLegible(dias) {
  const n = Math.abs(dias);
  const anios = Math.floor(n / 365);
  const resto = n % 365;
  const meses = Math.floor(resto / 30);
  const diasSueltos = resto % 30;
  const p = (cifra, singular, plural) => `${cifra} ${cifra === 1 ? singular : plural}`;
  const partes = [
    anios > 0 ? p(anios, 'año', 'años') : null,
    meses > 0 ? p(meses, 'mes', 'meses') : null,
    diasSueltos > 0 ? p(diasSueltos, 'día', 'días') : null,
  ].filter(Boolean);
  if (partes.length === 0) return p(0, 'día', 'días');
  return partes.slice(0, 2).join(' y ');
}

export function describirCaducidad(dias) {
  if (dias < -1) return `Caducado hace ${duracionLegible(dias)}`;
  if (dias === -1) return 'Caducó ayer';
  if (dias === 0) return 'Caduca hoy';
  if (dias === 1) return 'Caduca mañana';
  return `Caduca en ${duracionLegible(dias)}`;
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
