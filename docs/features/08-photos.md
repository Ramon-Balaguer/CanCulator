# Photos

- Each **product** has a photo and notes. The lot only has expiry, units and location. Old lot photos are used as a fallback and move to the product when it is uploaded again.
- The photo is taken with the phone's camera. It is compressed in the browser to a JPEG of at most 1000 px on the longest side.
- Photos live in IndexedDB, so they show offline.
- Photos travel between phones during sync: if one is missing, the phone asks for it one by one.
- The JSON export includes the photos.

Related: [ADR 0013](../adr/0013-photos-compressed-in-browser.md), [Phone sync](10-phone-sync.md).
