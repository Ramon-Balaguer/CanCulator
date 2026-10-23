// Number formatting for the screens: thousands separated, in the language of the app. No DOM.
const LOCALE = Object.freeze({ es: 'es-ES', en: 'en-US' });

// useGrouping 'always': Spanish groups only from five digits by default, and 4380 must read 4.380.
// decimales: most decimals shown; minimo: fewer than that are padded (2,40 €), otherwise not.
export function formatearNumero(n, idioma, { decimales = 0, minimo = 0 } = {}) {
  return new Intl.NumberFormat(LOCALE[idioma] ?? LOCALE.es, {
    useGrouping: 'always',
    minimumFractionDigits: minimo,
    maximumFractionDigits: decimales,
  }).format(n);
}
