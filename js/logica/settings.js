// Settings values. They are stored in the Configuracion table as {clave, valor, actualizado}.

export const DEFAULT_CATEGORIES = Object.freeze([
  'legumbres',
  'pescado',
  'carne',
  'verduras y hortalizas',
  'fruta',
  'sopas y platos preparados',
  'tomate y salsas',
  'lácteos de larga duración',
  'pasta',
  'arroz y cereales',
  'harinas y repostería',
  'aceites y condimentos',
  'agua y bebidas',
  'otros',
]);

export const DEFAULT_SETTINGS = Object.freeze({
  categorias: DEFAULT_CATEGORIES,
  ubicaciones: Object.freeze(['Despensa']),
  dias_caduca_pronto: 90,
  emails_avisos: Object.freeze([]),
  hora_aviso: '09:00',
});

export const KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS));

// Default values with what is stored on top.
export function effectiveSettings(rows = []) {
  const result = { ...DEFAULT_SETTINGS };
  for (const { clave: key, valor: value } of rows) {
    if (KEYS.includes(key)) result[key] = value;
  }
  return result;
}

function textList(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name}: debe ser una lista`);
  const seen = new Set();
  const list = [];
  for (const element of value) {
    const text = String(element ?? '').replace(/\s+/g, ' ').trim();
    const key = text.toLocaleLowerCase('es');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    list.push(text);
  }
  return list;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the normalized value or throws an error with a message for the user.
export function validateValue(key, value) {
  switch (key) {
    case 'categorias':
    case 'ubicaciones': {
      const list = textList(value, key);
      if (list.length === 0) throw new Error(`Hace falta al menos una ${key === 'categorias' ? 'categoría' : 'ubicación'}`);
      return list;
    }
    case 'dias_caduca_pronto': {
      const days = Number(value);
      if (!Number.isInteger(days) || days < 0 || days > 3650) {
        throw new Error('Los días de "caduca pronto" deben ser un número entero entre 0 y 3650');
      }
      return days;
    }
    case 'emails_avisos': {
      const list = textList(value, key).map((e) => e.toLowerCase());
      const bad = list.find((e) => !EMAIL_RE.test(e));
      if (bad) throw new Error(`Email no válido: ${bad}`);
      return [...new Set(list)];
    }
    case 'hora_aviso': {
      const time = String(value ?? '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('La hora debe tener el formato HH:MM');
      return time;
    }
    default:
      throw new Error(`Ajuste desconocido: ${key}`);
  }
}
