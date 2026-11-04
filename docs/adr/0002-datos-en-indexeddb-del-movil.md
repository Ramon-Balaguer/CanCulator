# ADR 0002: Datos en IndexedDB, en el propio móvil

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

La app tiene que funcionar sin conexión, incluido el modo avión, y los datos son de la casa. No conviene guardarlos en un servicio de terceros.

## Decisión

- Todo el inventario (productos, lotes, configuración, operaciones, fotos y caché de Open Food Facts) vive en IndexedDB del navegador de cada móvil.
- Las tablas se llaman como las de la hoja de cálculo original (`Productos`, `Lotes`, `Configuracion`, `Operaciones`, `Fotos`, `Meta`, `cache_off`). La base se llama `canculator`.
- Las migraciones de la base son versionadas (`MIGRATIONS` en `js/datos/db.js`): cada una solo crea lo que falta y no se editan las anteriores.

## Consecuencias

- Sin conexión no hay pérdida de datos ni pantallas vacías.
- Cada móvil tiene su copia; para compartir se usa la sincronización ([ADR 0004](0004-sincronizacion-p2p-webrtc.md)).
- Safari en iOS puede borrar datos de un sitio web tras un tiempo sin usarlo: por eso la app ofrece copia JSON, y la lista de pruebas en iPhone comprueba que los datos siguen una semana después.
- Cualquier cambio de esquema exige una migración nueva al final de la lista.
