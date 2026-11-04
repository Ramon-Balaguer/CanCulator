# ADR 0011: Deployment to GitHub Pages from CI

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The app must always be available at a public URL, installable from a phone, without running a server.

## Decision

- GitHub Pages serves the app. The workflow `.github/workflows/deploy.yml` runs the unit and end-to-end tests on every pull request and on every push to `main`.
- Only a push to `main` deploys: `scripts/build.mjs` prepares `_site/` with the commit hash and uploads it to Pages.
- The Pages and artifact-upload actions use their Node 24 versions; a test prevents going back to older versions.

## Consequences

- Merging into `main` is equivalent to publishing. That is why `main` must always pass the tests.
- A Playwright report is kept for 7 days if the tests fail.
- The version shown in the app (7 characters) makes it possible to check which commit is published.
