# Language

The app is available in Spanish (the default) and English. You choose the language in the first setting in **Ajustes**.

- The choice is stored in `localStorage` (key `cancalculator.idioma`). It is a per-phone preference and is not synced.
- The texts live in `js/logica/idioma.js`, with the functions `t()` and `traducir()`.
- Statistics numbers follow the chosen language (4.380 in Spanish, 4,380 in English).

Related: [ADR 0009](../adr/0009-language-per-device-localstorage.md).
