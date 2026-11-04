# ADR 0013: Photos compressed in the browser

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

A phone photo can weigh several megabytes. Storing it that way in IndexedDB and copying it during sync is slow and takes a lot of space.

## Decision

- The photo is scaled down in the browser (`js/datos/photos.js`): JPEG, at most 1000 px on the longest side, quality 0.8.
- The Open Food Facts front photo is stored in the same photos table.
- Photos are sent between phones one at a time, and only the missing ones.

## Consequences

- A few tens of kilobytes per photo, enough to recognise the product.
- No server processes images: everything happens on the phone.
- The original photos are not kept: only the reduced version.
