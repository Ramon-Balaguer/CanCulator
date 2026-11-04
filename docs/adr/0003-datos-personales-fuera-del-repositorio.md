# ADR 0003: Datos personales fuera del repositorio

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

El repositorio es público y se despliega en GitHub Pages. El inventario y las fotos de la casa son datos personales.

## Decisión

- El inventario nunca se guarda en el repositorio: vive en IndexedDB de cada móvil.
- `.gitignore` excluye exportaciones (`*.export.json`, `inventario-*.json`, `exportaciones/`), fotos (`fotos/`, `*.jpg`, `*.jpeg`, `*.heic`), secretos (`.env*`, `*token*`, `*secreto*`) y `vendor/`.
- Las capturas del README usan un inventario de demostración.

## Consecuencias

- Cualquier dato de prueba real debe quedarse en el móvil o en una copia fuera del repositorio.
- La protección de la sala de sincronización depende de la password, no de que el repositorio sea privado ([ADR 0004](0004-sincronizacion-p2p-webrtc.md)).
