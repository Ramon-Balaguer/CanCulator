# ADR 0004: Sincronización directa entre móviles por WebRTC (PeerJS)

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026). Sustituye a la sincronización con una hoja de cálculo y Apps Script ([ADR 0005](0005-sin-servidor-ni-hoja-de-calculo.md)).

## Contexto

Dos móviles de la misma casa deben compartir el inventario sin servidor propio ni cuenta de nube. Escribir a mano el intercambio de ofertas y respuestas WebRTC es complejo.

## Decisión

- Se usa WebRTC con PeerJS 1.5.5 (licencia MIT) solo para la señalización. Los datos viajan directamente entre los móviles.
- Un móvil crea la sala (**main**) y otro se une (**cliente**) con un código de seis caracteres y una password. El prefijo de la sala es `canculator-`.
- Antes de intercambiar datos, los dos móviles se saludan con una huella SHA-256 del token (`PROTOCOLO = 'canculator/1'`): el token nunca viaja en claro.
- La lógica de sincronización es pura y está en `js/logica/peer-sync.js`; el canal está en `js/datos/peer-link.js`.
- Las pruebas de WebRTC en el navegador se limitan a Chromium, porque WebKit de Playwright no conecta en este entorno.

## Consecuencias

- No hay coste de servidor de datos, pero sí dependemos del servicio público de señalización de PeerJS. Cuando falla, la app reintenta y el mensaje lo indica.
- Los dos móviles deben estar en la misma red o tener acceso a internet.
- Las pruebas e2e del servicio público son inestables; la lógica de reintento se prueba con un Peer simulado en tests unitarios.
