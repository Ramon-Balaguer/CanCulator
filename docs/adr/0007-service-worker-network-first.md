# ADR 0007: Service worker with network first and a cache fallback

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

App updates must arrive when there is a connection, but the app must also open without one.

## Decision

- `sw.js` asks the network first. If there is no connection, or the network takes more than 4 seconds, it serves the cached copy.
- The `PRECACHE` list stores the app and the modules that must work offline (including the number-formatting module).
- Each deployment replaces the `__COMMIT__` marker with the commit hash, so each version has its own cache.

## Consequences

- Updates arrive as soon as there is network.
- Every new module that is loaded on screen must be added to `PRECACHE`; if it is missing, the app does not open offline.
- A test prevents duplicate files in `PRECACHE`.
