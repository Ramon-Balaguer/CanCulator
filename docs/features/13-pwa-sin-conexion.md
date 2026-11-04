# App instalable y sin conexión

- Es una PWA: en Android, menú de Chrome → «Instalar aplicación»; en iPhone, Safari → Compartir → «Añadir a pantalla de inicio». Se abre sin la barra del navegador.
- El **service worker** (`sw.js`) pide primero la red y, si no hay conexión o tarda más de 4 segundos, usa la copia en caché.
- Los datos están en IndexedDB del propio móvil: funcionan sin conexión, y los cambios hechos offline se envían al reconectar.
- La app muestra **En línea** o **Sin conexión** según el estado de la red.
- La versión mostrada es el hash corto del commit desplegado; en local aparece «desarrollo».

Relacionado: [ADR 0007](../adr/0007-service-worker-red-primero.md), [ADR 0002](../adr/0002-datos-en-indexeddb-del-movil.md), [ADR 0011](../adr/0011-despliegue-github-pages-con-ci.md).
