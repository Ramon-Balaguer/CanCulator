# ADR 0005: Sin Apps Script ni hoja de cálculo como servidor de sincronización

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026). Sustituye al primer diseño, con una hoja de cálculo de Google y Apps Script como servidor.

## Contexto

El primer diseño guardaba el inventario en una hoja de Google y lo sincronizaba con un script de Apps Script. Requería una cuenta de Google, un despliegue de script y mantener dos fuentes de datos.

## Decisión

- Se eliminaron `apps-script/Code.gs`, el cliente de la hoja (`js/datos/sync.js`, `js/logica/sync-logic.js`) y sus fixtures.
- Los móviles se sincronizan solo entre ellos, por la sala P2P ([ADR 0004](0004-sincronizacion-p2p-webrtc.md)).
- Un test unitario falla si vuelve cualquier referencia a Apps Script o a `clasp`.
- Los nombres de las tablas locales se conservan del diseño anterior, para no perder el sentido de cada una.

## Consecuencias

- Sin cuenta de Google ni despliegue de script.
- Sin una copia central: si los dos móviles pierden sus datos a la vez, solo queda la copia JSON ([Copia de seguridad](../features/11-copia-de-seguridad-y-reset.md)).
