// Guesses the app category from the Open Food Facts product. No DOM or network.
// Rules are checked in order, so the most specific ones come first. Each rule maps
// words found in the OFF category tags (e.g. "en:canned-tunas") to a default category.
const RULES = [
  ['agua y bebidas', /beverage|drink|water|juice|soda|\bcolas?\b|beer|wine|coffee|tea\b|infusion|bebida|agua|zumo|refresco|cerveza|vino|cafe/],
  ['legumbres', /legume|pulse|lentil|chickpea|bean|pea\b|peas\b|legumbre|lenteja|garbanzo|alubia|judia/],
  ['pescado', /fish|tuna|sardine|mackerel|anchov|salmon|\bcod\b|seafood|shellfish|pescado|atun|sardina|caballa|bacalao|marisco|mejillon/],
  ['carne', /meat|beef|pork|chicken|turkey|\bham\b|sausage|charcuter|carne|jamon|embutido|pollo|ternera|cerdo|pate/],
  ['sopas y platos preparados', /soup|broth|meal|ready|prepared|stew|sopa|caldo|plato|guiso|cocido|fabada/],
  ['tomate y salsas', /tomato|sauce|ketchup|mayonnaise|pesto|tomate|salsa|sofrito/],
  ['lácteos de larga duración', /dairies|dairy|milk|cheese|yogurt|yoghurt|cream|butter|lacteo|leche|queso|nata|mantequilla/],
  ['pasta', /pasta|spaghetti|macaroni|noodle|fideo|macarron|espagueti/],
  ['arroz y cereales', /rice|cereal|muesli|oat|breakfast|grain|corn|arroz|avena|cereales|granola/],
  ['harinas y repostería', /flour|sugar|baking|cake|biscuit|cookie|chocolate|dessert|sweet|jam\b|honey|harina|azucar|galleta|pasteleria|reposteria|mermelada|miel/],
  ['aceites y condimentos', /oil|vinegar|spice|salt|condiment|seasoning|herb|aceite|vinagre|especia|sal\b|condimento/],
  ['verduras y hortalizas', /vegetable|legumes-and|canned-vegetable|verdura|hortaliza|pickle|encurtido|conserva-vegetal/],
  ['fruta', /fruit|apple|peach|pear|orange|nuts|fruta|melocoton|manzana|pera|naranja|frutos-secos/],
];

const normalize = (text) => String(text ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

// Returns the first category of the user's list that matches, or '' if nothing fits.
// Only categories that exist in "available" are returned, so the select never shows a stranger.
export function guessCategory(product, available) {
  const tags = Array.isArray(product?.categories_tags) ? product.categories_tags : [];
  const hasCategory = new Set(available);
  // Tag by tag, from the most specific (last) to the most generic (first): a generic tag such as
  // "plant-based-foods-and-beverages" must not win over "mueslis".
  for (const tag of [...tags].reverse()) {
    const text = normalize(tag);
    for (const [category, pattern] of RULES) {
      if (hasCategory.has(category) && pattern.test(text)) return category;
    }
  }
  return '';
}

// Front image URL: the medium size is plenty for a thumbnail and light to download.
export function frontImageUrl(product) {
  for (const key of ['image_front_url', 'image_front_small_url']) {
    const url = product?.[key];
    if (typeof url === 'string' && url.startsWith('https://')) return url;
  }
  return '';
}
