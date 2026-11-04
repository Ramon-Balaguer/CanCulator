# ADR 0009: Idioma por móvil, guardado en localStorage

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

La app pasa a ser bilingüe (español e inglés). Cada persona de la casa puede querer un idioma distinto en su móvil, y el inventario se sincroniza entre móviles.

## Decisión

- El idioma es una preferencia de cada móvil: se guarda en `localStorage` (clave `cancalculator.idioma`), no en la base de datos.
- Los textos viven en `js/logica/idioma.js`, en un objeto por idioma, con las funciones `t()` y `traducir()`. El idioma por defecto es español.
- El nombre de cada idioma se escribe en ese mismo idioma (Español, English), para reconocerlo aunque la app esté en el otro.

## Consecuencias

- El idioma no se sincroniza: dos móviles de la misma sala pueden mostrar idiomas distintos.
- Cada texto nuevo debe tener su traducción en español e inglés en `js/logica/idioma.js`.
- El README está en inglés; las pruebas para móviles (`docs/mobile-checklist.md`) siguen en español.
