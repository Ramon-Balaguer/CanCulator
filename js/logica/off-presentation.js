// Turns a product from Open Food Facts into something that can be read on screen.
// No DOM: everything is text and lists. The interface paints it with textContent.

// Readable product fields, grouped. Anything without a value is not shown.
const SECTIONS = [
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

// Text of any API value. Lists are joined with commas; objects, as JSON.
export function readableValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join(', ');
  return JSON.stringify(value);
}

export function sections(product) {
  return SECTIONS
    .map((s) => ({
      titulo: s.titulo,
      filas: s.campos
        .map(([key, etiqueta]) => ({ etiqueta, valor: readableValue(product[key]) }))
        .filter((f) => f.valor !== ''),
    }))
    .filter((s) => s.filas.length > 0);
}

// Nutrients per 100 g: keys "<name>_100g" with their unit "<name>_unit".
export function nutrients(product) {
  const n = product.nutriments ?? {};
  return Object.keys(n)
    .filter((k) => k.endsWith('_100g') && typeof n[k] === 'number')
    .map((k) => {
      const base = k.slice(0, -'_100g'.length);
      return { nombre: base.replace(/[-_]/g, ' '), valor: n[k], unidad: readableValue(n[`${base}_unit`]) };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

// Product photos: only the normal size (not thumbnails).
const IMAGE_LABELS = {
  image_front_url: 'Frontal',
  image_ingredients_url: 'Ingredientes',
  image_nutrition_url: 'Tabla nutricional',
  image_packaging_url: 'Envase',
};
export function images(product) {
  return Object.entries(IMAGE_LABELS)
    .filter(([key]) => typeof product[key] === 'string' && product[key].startsWith('http'))
    .map(([key, etiqueta]) => ({ etiqueta, url: product[key] }));
}

// All response fields, in alphabetical order. This is what makes "all the information".
export function allFields(product) {
  return Object.keys(product)
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((key) => ({ clave: key, valor: readableValue(product[key]) }));
}
