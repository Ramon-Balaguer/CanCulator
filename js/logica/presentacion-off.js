// Convierte un producto de Open Food Facts en algo que se puede leer en pantalla.
// Sin DOM: todo son textos y listas. La interfaz lo pinta con textContent.

// Campos con nombre legible, agrupados. Lo que no tenga valor no se muestra.
const SECCIONES = [
  {
    titulo: 'Producto',
    campos: [
      ['product_name', 'Nombre'],
      ['brands', 'Marca'],
      ['quantity', 'Cantidad'],
      ['categories', 'Categorías'],
      ['code', 'Código de barras'],
      ['packaging', 'Envase'],
      ['labels', 'Etiquetas'],
      ['stores', 'Tiendas'],
      ['countries', 'Países'],
    ],
  },
  {
    titulo: 'Puntuaciones',
    campos: [
      ['nutriscore_grade', 'Nutri-Score'],
      ['ecoscore_grade', 'Eco-Score'],
      ['nova_group', 'Grupo NOVA'],
    ],
  },
  {
    titulo: 'Ingredientes y alérgenos',
    campos: [
      ['ingredients_text', 'Ingredientes'],
      ['allergens', 'Alérgenos'],
      ['traces', 'Trazas'],
      ['additives_tags', 'Aditivos'],
      ['ingredients_analysis_tags', 'Análisis de ingredientes'],
    ],
  },
];

// Texto de un valor cualquiera de la API. Listas se unen con comas; objetos, como JSON.
export function valorLegible(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor.trim();
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  if (Array.isArray(valor)) return valor.map(valorLegible).filter(Boolean).join(', ');
  return JSON.stringify(valor);
}

export function secciones(producto) {
  return SECCIONES
    .map((s) => ({
      titulo: s.titulo,
      filas: s.campos
        .map(([clave, etiqueta]) => ({ etiqueta, valor: valorLegible(producto[clave]) }))
        .filter((f) => f.valor !== ''),
    }))
    .filter((s) => s.filas.length > 0);
}

// Nutrientes por 100 g: claves "<nombre>_100g" con su unidad "<nombre>_unit".
export function nutrientes(producto) {
  const n = producto.nutriments ?? {};
  return Object.keys(n)
    .filter((k) => k.endsWith('_100g') && typeof n[k] === 'number')
    .map((k) => {
      const base = k.slice(0, -'_100g'.length);
      return { nombre: base.replace(/[-_]/g, ' '), valor: n[k], unidad: valorLegible(n[`${base}_unit`]) };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Fotos del producto: solo las de tamaño normal (no miniaturas).
const ETIQUETAS_IMAGEN = {
  image_front_url: 'Frontal',
  image_ingredients_url: 'Ingredientes',
  image_nutrition_url: 'Tabla nutricional',
  image_packaging_url: 'Envase',
};
export function imagenes(producto) {
  return Object.entries(ETIQUETAS_IMAGEN)
    .filter(([clave]) => typeof producto[clave] === 'string' && producto[clave].startsWith('http'))
    .map(([clave, etiqueta]) => ({ etiqueta, url: producto[clave] }));
}

// Todos los campos de la respuesta, en orden alfabético. Es lo que hace "toda la información".
export function todosLosCampos(producto) {
  return Object.keys(producto)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((clave) => ({ clave, valor: valorLegible(producto[clave]) }));
}
