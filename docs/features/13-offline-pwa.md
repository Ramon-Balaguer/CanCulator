# Installable app and offline use

- It is a PWA: on Android, Chrome menu → «Instalar aplicación»; on iPhone, Safari → Share → «Añadir a pantalla de inicio». It opens without the browser bar.
- The **service worker** (`sw.js`) asks the network first. If there is no connection, or the network takes more than 4 seconds, it uses the cached copy.
- The data is in the phone's own IndexedDB: it works offline, and changes made offline are sent when the phone reconnects.
- The app shows **En línea** (online) or **Sin conexión** (offline) depending on the network state.
- The version shown is the short hash of the deployed commit; locally it shows «desarrollo».

Related: [ADR 0007](../adr/0007-service-worker-network-first.md), [ADR 0002](../adr/0002-data-in-indexeddb-on-device.md), [ADR 0011](../adr/0011-github-pages-deploy-from-ci.md).
