# ADR 0001: Static web app with no build step

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The app is used by one family, from their phones. It has to be installable without an app store and work without a server of its own.

## Decision

- The app is plain HTML, CSS and native JavaScript modules, served as static files on GitHub Pages.
- The interface uses Preact and htm (templates as text, no JSX), and the barcode reader uses ZXing. Their browser builds are copied to `vendor/` with `npm run vendor`; `vendor/` is not committed, and an import map links the modules.
- `npm run construir` only copies the published files to `_site/` and injects the commit hash. It does not transpile or bundle anything.

## Consequences

- What is published is the same code that runs locally: there are no hidden differences from compilation.
- No server or cloud database is needed.
- Without JSX or a bundler, code is written more carefully and dependencies are managed by hand (through `vendor/`).
- The `PRECACHE` list in `sw.js` must be maintained by hand when a module that must work offline is added.
