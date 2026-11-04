# Fotos

- Cada **producto** tiene una foto y observaciones. El lote solo tiene caducidad, unidades y ubicación. Las fotos antiguas de lotes se usan como respaldo y pasan al producto al subirlas.
- La foto se hace con la cámara del móvil. Se comprime en el navegador a JPEG de como máximo 1000 px por el lado largo.
- Las fotos viven en IndexedDB, así que se ven sin conexión.
- Las fotos viajan entre móviles en la sincronización: si falta alguna, el móvil la pide una a una.
- La exportación JSON incluye las fotos.

Relacionado: [ADR 0013](../adr/0013-fotos-comprimidas-en-el-navegador.md), [Sincronización](10-sincronizacion-entre-moviles.md).
