# CanCulator

App web instalable (PWA) para inventariar la comida no perecedera de casa: qué hay, cuándo caduca y qué falta.
Funciona sin conexión y los móviles de casa se sincronizan entre sí, en la misma Wi-Fi.

Publicada en https://ramon-balaguer.github.io/canculator/

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
- `js/datos/off.js`: consulta a Open Food Facts con caché (`cache_off`). `node scripts/check-off.mjs` hace una consulta real de comprobación.
- `camera-test.html`: diagnóstico de cámara y lectura de códigos en el móvil.
- `sw.js`: service worker, red primero y caché si no hay conexión o la red tarda más de 4 s. El despliegue sustituye `__COMMIT__` por el hash del commit.
- `js/datos/peer-link.js` y `js/logica/peer-sync.js`: sincronización directa entre móviles (sala WebRTC, cola de operaciones, fotos).
- `scripts/build.mjs`: prepara `_site/` para GitHub Pages (copia e inyecta la versión).
- `docs/mobile-checklist.md`: comprobaciones manuales en móvil por fase.

Cada push a `main` ejecuta las pruebas y, si pasan, despliega en GitHub Pages (`.github/workflows/deploy.yml`).

## Datos

Los datos viven en el móvil (IndexedDB). Nunca en este repositorio, que es público.
