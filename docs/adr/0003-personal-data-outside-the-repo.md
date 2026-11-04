# ADR 0003: Personal data outside the repository

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The repository is public and deployed on GitHub Pages. The household's inventory and photos are personal data.

## Decision

- The inventory is never stored in the repository: it lives in the IndexedDB of each phone.
- `.gitignore` excludes exports (`*.export.json`, `inventario-*.json`, `exportaciones/`), photos (`fotos/`, `*.jpg`, `*.jpeg`, `*.heic`), secrets (`.env*`, `*token*`, `*secreto*`) and `vendor/`.
- The README screenshots use a demo inventory.

## Consequences

- Any real test data must stay on the phone or in a copy outside the repository.
- The protection of the sync room depends on the password, not on the repository being private ([ADR 0004](0004-p2p-sync-webrtc.md)).
