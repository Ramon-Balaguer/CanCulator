# ADR 0008: Open Food Facts con caché local y tolerancia a fallos

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

Escribir los datos de cada producto a mano es lento. [Open Food Facts](https://world.openfoodfacts.org) tiene nombre, categoría, nutrición y foto por código de barras, pero no siempre hay red.

## Decisión

- Al escanear, se consulta Open Food Facts con un tiempo máximo de 8 segundos. La respuesta se guarda en la tabla `cache_off`.
- La foto frontal se descarga y se guarda en IndexedDB (`off-<código>`), para no depender de `images.openfoodfacts.org` al mostrar la lista.
- Si no hay red o no está el producto, la consulta devuelve un estado y el alta sigue a mano. Nunca lanza error al usuario.
- La consulta se hace solo al escanear, nunca al cargar la app.

## Consecuencias

- Escanear dos veces el mismo código no vuelve a la red.
- Los datos de OFF pueden estar desactualizados respecto a la web, porque la caché guarda la última respuesta recibida.
- Hay que respetar el uso razonable de la API pública: nada de consultas en bucle.
