// Códigos de barras de productos (GTIN: EAN-13, EAN-8, UPC-A, GTIN-14).

const TIPOS = { 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'GTIN-14' };

// Quita espacios y guiones que a veces se cuelan al teclear o leer.
export function normalizarCodigo(texto) {
  return String(texto ?? '').trim().replace(/[\s-]/g, '');
}

// Dígito de control GTIN: pesos 3 y 1 alternos empezando por la derecha.
export function digitoControl(sinControl) {
  let suma = 0;
  for (let i = 0; i < sinControl.length; i++) {
    const digito = Number(sinControl[sinControl.length - 1 - i]);
    suma += digito * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (suma % 10)) % 10;
}

export function tipoCodigo(codigo) {
  const limpio = normalizarCodigo(codigo);
  return /^\d+$/.test(limpio) ? (TIPOS[limpio.length] ?? null) : null;
}

export function esGtinValido(codigo) {
  const limpio = normalizarCodigo(codigo);
  if (!tipoCodigo(limpio)) return false;
  return digitoControl(limpio.slice(0, -1)) === Number(limpio.at(-1));
}
