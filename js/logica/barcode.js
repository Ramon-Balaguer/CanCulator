// Códigos de barras de productos (GTIN: EAN-13, EAN-8, UPC-A, GTIN-14).

const GTIN_TYPES = { 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'GTIN-14' };

// Quita espacios y guiones que a veces se cuelan al teclear o leer.
export function normalizeCode(text) {
  return String(text ?? '').trim().replace(/[\s-]/g, '');
}

// Dígito de control GTIN: pesos 3 y 1 alternos empezando por la derecha.
export function checkDigit(noCheck) {
  let sum = 0;
  for (let i = 0; i < noCheck.length; i++) {
    const digit = Number(noCheck[noCheck.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

export function codeType(code) {
  const cleanData = normalizeCode(code);
  return /^\d+$/.test(cleanData) ? (GTIN_TYPES[cleanData.length] ?? null) : null;
}

export function isValidGtin(code) {
  const cleanData = normalizeCode(code);
  if (!codeType(cleanData)) return false;
  return checkDigit(cleanData.slice(0, -1)) === Number(cleanData.at(-1));
}
