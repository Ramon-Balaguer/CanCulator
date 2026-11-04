# Open Food Facts

Al escanear un código de barras, la app consulta [Open Food Facts](https://world.openfoodfacts.org) y rellena el producto.

- Aviso «Open Food Facts: …» cuando encuentra el producto; «No está en Open Food Facts» cuando no está. En ese caso se escribe el nombre a mano.
- La respuesta se guarda en caché local (tabla `cache_off`). Escanear dos veces el mismo código no vuelve a consultar la red.
- La consulta solo se hace al escanear, no en bucle al cargar la app.
- La foto frontal del producto se guarda en IndexedDB (id `off-<código>`), así se ve sin conexión.
- Desde la ficha: «Ver todos los datos de Open Food Facts» muestra fotos, ingredientes, nutrientes y campos. Sin conexión, sigue disponible desde «Datos de Open Food Facts» en Stock.
- Si la red tarda más de 8 segundos, la consulta se cancela y el alta sigue a mano.
- La categoría se sugiere a partir de las etiquetas de OFF; las categorías de carne, pescado y preparados frescos se distinguen de las genéricas, y si el usuario no las tiene, el producto cae en la general.

Relacionado: [Alta de lotes](06-alta-de-lotes-y-escaner.md), [ADR 0008](../adr/0008-open-food-facts-con-cache-local.md).
