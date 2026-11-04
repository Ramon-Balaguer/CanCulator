# ADR 0009: Language per device, stored in localStorage

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The app becomes bilingual (Spanish and English). Each person in the household may want a different language on their phone, and the inventory is synced between phones.

## Decision

- The language is a per-phone preference: it is stored in `localStorage` (key `cancalculator.idioma`), not in the database.
- The texts live in `js/logica/idioma.js`, one object per language, with the functions `t()` and `traducir()`. The default language is Spanish.
- Each language's name is written in that language (Español, English), so it can be recognised even when the app is in the other one.

## Consequences

- The language is not synced: two phones in the same room can show different languages.
- Every new text must have a Spanish and an English translation in `js/logica/idioma.js`.
- The README is in English; the phone test checklist (`docs/mobile-checklist.md`) is also in English.
