# ADR 0011: Despliegue en GitHub Pages desde CI

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

La app tiene que estar siempre en una URL pública, instalable desde el móvil, sin gestionar un servidor.

## Decisión

- GitHub Pages sirve la app. El workflow `.github/workflows/deploy.yml` corre las pruebas unitarias y e2e en cada PR y en cada push a `main`.
- Solo un push a `main` despliega: `scripts/build.mjs` prepara `_site/` con el hash del commit y lo sube a Pages.
- Las acciones de Pages y de subida de artefactos están en sus versiones de Node 24; un test impide volver a versiones antiguas.

## Consecuencias

- Mergear a `main` equivale a publicar. Por eso `main` debe pasar siempre las pruebas.
- Un informe de Playwright se guarda 7 días si fallan las pruebas.
- La versión visible en la app (7 caracteres) permite comprobar qué commit está publicado.
