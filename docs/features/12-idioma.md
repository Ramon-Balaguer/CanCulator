# Idioma

La app está en español (por defecto) e inglés. Se elige en el primer ajuste de **Ajustes**.

- La elección se guarda en `localStorage` (clave `cancalculator.idioma`): es preferencia de cada móvil y no se sincroniza.
- Los textos viven en `js/logica/idioma.js`, con las funciones `t()` y `traducir()`.
- Los números de las estadísticas siguen el idioma elegido (4.380 en español, 4,380 en inglés).

Relacionado: [ADR 0009](../adr/0009-idioma-por-movil-en-localstorage.md).
