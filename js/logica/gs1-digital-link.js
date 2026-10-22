// GS1 Digital Link: a web address that carries the product data as pairs of identifier and value,
// for example https://id.gs1.org/01/04006381333931/10/LOTE/17/261231. Some QR codes on products
// use it instead of the barcode digits. 01 is the GTIN (the code Open Food Facts knows) and
// 17 is the expiry date, written AAMMDD.
import { isValidGtin, normalizeCode } from './barcode.js';

// { '01': '04006381333931', '10': 'LOTE', '17': '261231' }, or null if the text is not a web address.
function identificadores(texto) {
  let url;
  try {
    url = new URL(String(texto ?? '').trim());
  } catch {
    return null;
  }
  const partes = url.pathname.split('/').filter(Boolean);
  const pares = {};
  for (let i = 0; i + 1 < partes.length; i += 2) pares[partes[i]] = partes[i + 1];
  return pares;
}

// Returns the GTIN (EAN-13 when it fits, GTIN-14 otherwise), or null if the text is not a valid one.
export function gtinDesdeDigitalLink(texto) {
  const gtin14 = identificadores(texto)?.['01'];
  if (!/^\d{14}$/.test(gtin14 ?? '')) return null;
  // A GTIN-14 with indicator digit 0 is an EAN-13 with a leading zero.
  const gtin = gtin14.replace(/^0(?=\d{13}$)/, '');
  return isValidGtin(gtin) ? gtin : null;
}

// Expiry date in ISO format (YYYY-MM-DD), or null if the QR does not carry a valid one.
// A day of 00 means the last day of the month, as GS1 defines it.
export function caducidadDesdeDigitalLink(texto) {
  const aammdd = identificadores(texto)?.['17'];
  if (!/^\d{6}$/.test(aammdd ?? '')) return null;
  const año = 2000 + Number(aammdd.slice(0, 2));
  const mes = Number(aammdd.slice(2, 4));
  let dia = Number(aammdd.slice(4, 6));
  if (mes < 1 || mes > 12) return null;
  // Day 0 of the next month is the last day of this one.
  const ultimoDia = new Date(Date.UTC(año, mes, 0)).getUTCDate();
  if (dia === 0) dia = ultimoDia;
  if (dia < 1 || dia > ultimoDia) return null;
  return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// What a scanner or a typed entry means: the GTIN of a Digital Link, or the code itself.
export function codigoDesdeTexto(texto) {
  return gtinDesdeDigitalLink(texto) ?? normalizeCode(texto);
}
