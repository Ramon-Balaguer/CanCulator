# Inventario de casa

App web instalable (PWA) para inventariar la comida no perecedera de casa: qué hay, cuándo caduca y qué falta.
Funciona sin conexión y se sincroniza con una Google Sheet.

Publicada en https://ramon-balaguer.github.io/survivor-resources/

## Desarrollo

Sin frameworks ni paso de compilación: HTML, CSS y módulos JavaScript nativos.

```bash
npm install
npx playwright install chromium webkit
npm run servir      # http://localhost:4173/inventario/
npm test            # unitarias (node --test) y E2E (Playwright)
```

- `js/logica/`: lógica sin DOM, probada con `node --test`.
- `sw.js`: service worker, red primero y caché si no hay conexión. El despliegue sustituye `__COMMIT__` por el hash del commit.
- `scripts/construir.mjs`: prepara `_site/` para GitHub Pages (copia e inyecta la versión).
- `docs/checklist-movil.md`: comprobaciones manuales en móvil por fase.

Cada push a `main` ejecuta las pruebas y, si pasan, despliega en GitHub Pages (`.github/workflows/deploy.yml`).

## Datos

Los datos viven en el móvil (IndexedDB) y en la Google Sheet. Nunca en este repositorio, que es público.
