# ADR 0007: Service worker con red primero y caché de respaldo

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

Hay que recibir las actualizaciones de la app cuando hay conexión, pero que la app abra también sin ella.

## Decisión

- `sw.js` pide la red primero. Si no hay conexión, o si la red tarda más de 4 segundos, sirve la copia de la caché.
- La lista `PRECACHE` guarda la app y los módulos que deben funcionar offline (incluidos los de formato de números).
- Cada despliegue reemplaza el marcador `__COMMIT__` por el hash del commit, así que cada versión tiene su caché.

## Consecuencias

- Las actualizaciones llegan en cuanto hay red.
- Hay que añadir a `PRECACHE` cada módulo nuevo que se cargue en pantalla; si falta, la app no abre sin conexión.
- Un test impide tener ficheros duplicados en `PRECACHE`.
