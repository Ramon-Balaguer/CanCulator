# ADR 0002: Data in IndexedDB, on the device

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The app has to work offline, including in airplane mode, and the data belongs to the household. It should not be stored in a third-party service.

## Decision

- The whole inventory (products, lots, settings, operations, photos and the Open Food Facts cache) lives in the IndexedDB of each phone's browser.
- The tables are named after the tables of the original spreadsheet (`Productos`, `Lotes`, `Configuracion`, `Operaciones`, `Fotos`, `Meta`, `cache_off`). The database is called `canculator`.
- Database migrations are versioned (`MIGRATIONS` in `js/datos/db.js`): each one only creates what is missing, and earlier ones are never edited.

## Consequences

- Offline use causes no data loss and no empty screens.
- Each phone has its own copy; sharing happens through sync ([ADR 0004](0004-p2p-sync-webrtc.md)).
- Safari on iOS can delete a website's data after a period of non-use. That is why the app offers a JSON backup, and the iPhone test list checks that the data is still there a week later.
- Any schema change requires a new migration at the end of the list.
