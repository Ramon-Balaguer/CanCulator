# ADR 0005: No Apps Script or spreadsheet as sync server

## Status

Accepted (reconstructed from the repository history, October 2026). It replaces the first design, which used a Google spreadsheet and Apps Script as the server.

## Context

The first design stored the inventory in a Google spreadsheet and synced it with an Apps Script. It required a Google account, a script deployment, and maintaining two data sources.

## Decision

- `apps-script/Code.gs`, the spreadsheet client (`js/datos/sync.js`, `js/logica/sync-logic.js`) and their fixtures were removed.
- Phones sync only with each other, through the P2P room ([ADR 0004](0004-p2p-sync-webrtc.md)).
- A unit test fails if any reference to Apps Script or `clasp` comes back.
- The local table names are kept from the earlier design, so each one keeps its meaning.

## Consequences

- No Google account and no script deployment are needed.
- There is no central copy: if both phones lose their data at the same time, only the JSON backup remains ([Backup and reset](../features/11-backup-and-reset.md)).
