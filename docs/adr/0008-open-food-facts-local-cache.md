# ADR 0008: Open Food Facts with a local cache and failure tolerance

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

Typing each product's details by hand is slow. [Open Food Facts](https://world.openfoodfacts.org) has the name, category, nutrition and photo for a barcode, but there is not always a network connection.

## Decision

- When a barcode is scanned, Open Food Facts is queried with a maximum wait of 8 seconds. The response is stored in the `cache_off` table.
- The front photo is downloaded and stored in IndexedDB (`off-<code>`), so the list does not depend on `images.openfoodfacts.org` when it is displayed.
- If there is no network or the product is not found, the query returns a status and the lot can still be added by hand. It never throws an error to the user.
- The query only runs when scanning, never when the app loads.

## Consequences

- Scanning the same barcode twice does not go to the network again.
- OFF data can be out of date compared with the website, because the cache keeps the last response received.
- Public API usage must stay reasonable: no looped queries.
