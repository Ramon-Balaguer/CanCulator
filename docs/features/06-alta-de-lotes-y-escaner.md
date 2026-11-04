# Alta de lotes y escáner

Botón **+** para añadir un lote. Se escribe el nombre del producto o se escanea su código de barras con la cámara.

- Si el código está en Open Food Facts, el nombre, la categoría y los datos nutricionales se rellenan solos.
- Se leen también los QR GS1 Digital Link (por ejemplo, algunas etiquetas de supermercado): el GTIN sirve como código y la caducidad (identificador 17, o parámetro `?17=`) rellena el campo Caducidad.
- Desde la ficha de un producto, el alta solo pide ubicación, caducidad y unidades, porque el producto ya se conoce.
- Si el producto ya existe, el nombre queda fijo.
- Cada producto puede tener foto y observaciones (ver [Fotos](08-fotos.md)).

Sin conexión, el escaneo de un código nuevo avisa de que no hay conexión y el alta se puede hacer a mano.

Relacionado: [Open Food Facts](07-open-food-facts.md), [Peso, volumen y precio](14-peso-volumen-y-precio.md).
