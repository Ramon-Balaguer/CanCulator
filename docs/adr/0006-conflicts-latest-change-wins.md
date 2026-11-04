# ADR 0006: Conflicts: the latest change wins

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

Two phones can change the same record while they are not connected to each other. A simple, predictable rule is needed, and operations must neither be lost nor applied twice.

## Decision

- Each local change creates an operation (`crear`, `editar`, `consumir`, `reponer`, `borrar`) with its date and device. Offline changes wait in a queue.
- When a received operation is applied, the record with the most recent date wins. Applied operation ids are remembered (up to 5000) so they are not applied again.
- On connect, each phone sends its full state (products, lots and settings) and merges the other one's, so no record is left unsent.
- Settings (categories, locations) are stored by key with the same rule.

## Consequences

- The rule is easy to explain: "the last change wins".
- Two simultaneous changes to the same field are resolved without asking the user; the result is visible in the data, not in a warning.
- The rules live in `js/logica/peer-sync.js` with no DOM or network access, and are tested with `node --test`.
