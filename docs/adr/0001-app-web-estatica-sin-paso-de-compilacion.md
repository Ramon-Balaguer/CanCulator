# ADR 0001: App web estática, sin paso de compilación

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

La app la usa una familia en su casa, desde el móvil. Hace falta que se instale sin tienda de aplicaciones y que funcione sin servidor propio.

## Decisión

- La app es HTML, CSS y módulos JavaScript nativos, servidos como ficheros estáticos en GitHub Pages.
- La interfaz usa Preact y htm (plantillas como texto, sin JSX), y el lector de códigos usa ZXing. Sus builds de navegador se copian a `vendor/` con `npm run vendor`; `vendor/` no se versiona y un import map enlaza los módulos.
- `npm run construir` solo copia los ficheros publicados a `_site/` e inyecta el hash del commit. No transpila ni empaqueta nada.

## Consecuencias

- Lo que se publica es el mismo código que se ejecuta en local: no hay diferencias ocultas por compilación.
- No hace falta servidor ni base de datos en la nube.
- Sin JSX ni bundler, el código se escribe con más cuidado y las dependencias se gestionan a mano (vía `vendor/`).
- Hay que mantener la lista `PRECACHE` de `sw.js` a mano cuando se añade un módulo que debe funcionar sin conexión.
