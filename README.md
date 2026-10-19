# Inventario de casa

App web instalable (PWA) para inventariar la comida no perecedera de casa: qué hay, cuándo caduca y qué falta.
Funciona sin conexión y se sincroniza con una Google Sheet.

Publicada en https://ramon-balaguer.github.io/survivor-resources/

## Desarrollo

Sin paso de compilación: HTML, CSS y módulos JavaScript nativos. La interfaz usa Preact + htm
(plantillas en texto, sin JSX) y la lectura de códigos de barras usa ZXing. `npm run vendor` copia
sus builds de navegador a `vendor/` (no se sube al repositorio) y un import map las enlaza.

```bash
npm install
npx playwright install chromium webkit
npm run servir      # http://localhost:4173/inventario/
npm test            # unitarias (node --test) y E2E (Playwright)
```

- `js/logica/`: lógica sin DOM, probada con `node --test`.
- `js/datos/off.js`: consulta a Open Food Facts con caché (`cache_off`). `node scripts/comprobar-off.mjs` hace una consulta real de comprobación.
- `prueba-camara.html`: diagnóstico de cámara y lectura de códigos en el móvil.
- `sw.js`: service worker, red primero y caché si no hay conexión o la red tarda más de 4 s. El despliegue sustituye `__COMMIT__` por el hash del commit.
- `js/datos/sincro.js` y `js/logica/sincronizacion.js`: sincronización con la hoja (cola de operaciones, fusión por `actualizado`, fotos a Drive).
- `apps-script/Code.gs`: servidor de Apps Script (se pega en la hoja). Puesta en marcha en `docs/apps-script.md`.
- `scripts/construir.mjs`: prepara `_site/` para GitHub Pages (copia e inyecta la versión).
- `docs/checklist-movil.md`: comprobaciones manuales en móvil por fase.

Cada push a `main` ejecuta las pruebas y, si pasan, despliega en GitHub Pages (`.github/workflows/deploy.yml`).

## Datos

Los datos viven en el móvil (IndexedDB) y en la Google Sheet. Nunca en este repositorio, que es público.
