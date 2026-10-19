// Valores de Ajustes. Se guardan en la tabla Configuracion como {clave, valor, actualizado}.

export const CATEGORIAS_POR_DEFECTO = Object.freeze([
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

export const CONFIGURACION_POR_DEFECTO = Object.freeze({
  categorias: CATEGORIAS_POR_DEFECTO,
  ubicaciones: Object.freeze(['Despensa']),
  dias_caduca_pronto: 90,
  emails_avisos: Object.freeze([]),
  hora_aviso: '09:00',
});

export const CLAVES = Object.freeze(Object.keys(CONFIGURACION_POR_DEFECTO));

// Valores por defecto con lo guardado encima.
export function configuracionEfectiva(filas = []) {
  const resultado = { ...CONFIGURACION_POR_DEFECTO };
  for (const { clave, valor } of filas) {
    if (CLAVES.includes(clave)) resultado[clave] = valor;
  }
  return resultado;
}

function listaDeTextos(valor, nombre) {
  if (!Array.isArray(valor)) throw new Error(`${nombre}: debe ser una lista`);
  const vistos = new Set();
  const lista = [];
  for (const elemento of valor) {
    const texto = String(elemento ?? '').replace(/\s+/g, ' ').trim();
    const clave = texto.toLocaleLowerCase('es');
    if (!texto || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(texto);
  }
  return lista;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Devuelve el valor normalizado o lanza un error con un mensaje para el usuario.
export function validarValor(clave, valor) {
  switch (clave) {
    case 'categorias':
    case 'ubicaciones': {
      const lista = listaDeTextos(valor, clave);
      if (lista.length === 0) throw new Error(`Hace falta al menos una ${clave === 'categorias' ? 'categoría' : 'ubicación'}`);
      return lista;
    }
    case 'dias_caduca_pronto': {
      const dias = Number(valor);
      if (!Number.isInteger(dias) || dias < 0 || dias > 3650) {
        throw new Error('Los días de "caduca pronto" deben ser un número entero entre 0 y 3650');
      }
      return dias;
    }
    case 'emails_avisos': {
      const lista = listaDeTextos(valor, clave).map((e) => e.toLowerCase());
      const malo = lista.find((e) => !EMAIL.test(e));
      if (malo) throw new Error(`Email no válido: ${malo}`);
      return [...new Set(lista)];
    }
    case 'hora_aviso': {
      const hora = String(valor ?? '').trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('La hora debe tener el formato HH:MM');
      return hora;
    }
    default:
      throw new Error(`Ajuste desconocido: ${clave}`);
  }
}
