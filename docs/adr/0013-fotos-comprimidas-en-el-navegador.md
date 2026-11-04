# ADR 0013: Fotos comprimidas en el navegador

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

Las fotos de un móvil pueden pesar varios megabytes. Guardarlas así en IndexedDB y copiarlas en la sincronización es lento y ocupa mucho espacio.

## Decisión

- La foto se reduce en el navegador (`js/datos/photos.js`): JPEG, como máximo 1000 px por el lado largo, calidad 0.8.
- La foto frontal de Open Food Facts se guarda en la misma tabla de fotos.
- Las fotos se envían entre móviles una a una, solo las que faltan.

## Consecuencias

- Pocas decenas de kilobytes por foto, suficientes para reconocer el producto.
- No hay servidor que procese imágenes: todo ocurre en el móvil.
- Las fotos originales no se guardan: solo la versión reducida.
