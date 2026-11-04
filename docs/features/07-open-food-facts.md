# Open Food Facts

When a barcode is scanned, the app queries [Open Food Facts](https://world.openfoodfacts.org) and fills in the product.

- A notice «Open Food Facts: …» appears when the product is found; «No está en Open Food Facts» appears when it is not. In that case the name is typed by hand.
- The response is stored in a local cache (table `cache_off`). Scanning the same barcode twice does not query the network again.
- The query only runs when scanning, never in a loop when the app loads.
- The front photo of the product is stored in IndexedDB (id `off-<barcode>`), so it shows offline.
- From the product sheet, «Ver todos los datos de Open Food Facts» (see all Open Food Facts data) shows photos, ingredients, nutrients and fields. Offline, it remains available from «Datos de Open Food Facts» in Stock.
- If the network takes longer than 8 seconds, the query is cancelled and the lot can still be added by hand.
- The category is suggested from the OFF labels. Fresh meat, fresh fish and fresh ready-meal categories are kept apart from the generic ones; if the user does not have them, the product falls back to the general category.

Related: [Adding lots and scanner](06-adding-lots-and-scanner.md), [ADR 0008](../adr/0008-open-food-facts-local-cache.md).
