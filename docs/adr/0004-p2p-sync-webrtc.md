# ADR 0004: Direct sync between phones over WebRTC (PeerJS)

## Status

Accepted (reconstructed from the repository history, October 2026). It replaces the spreadsheet and Apps Script sync ([ADR 0005](0005-no-apps-script-or-spreadsheet.md)).

## Context

Two phones in the same household must share the inventory without a server of our own and without a cloud account. Writing the WebRTC offer and answer exchange by hand is complex.

## Decision

- WebRTC is used through PeerJS 1.5.5 (MIT licence), only for signalling. The data travels directly between the phones.
- One phone creates the room (**main**) and another joins it (**client**) with a six-character code and a password. The room prefix is `canculator-`.
- Before exchanging data, the two phones greet each other with a SHA-256 fingerprint of the token (`PROTOCOLO = 'canculator/1'`), so the token is never sent in clear text.
- The synchronisation logic is pure and lives in `js/logica/peer-sync.js`; the channel lives in `js/datos/peer-link.js`.
- Browser WebRTC tests are limited to Chromium, because Playwright's WebKit does not connect in this environment.

## Consequences

- There is no data-server cost, but we depend on PeerJS's public signalling service. When it fails, the app retries and shows a message.
- Both phones must be on the same network or have internet access.
- End-to-end tests against the public signalling service are unstable; the retry logic is tested with a simulated Peer in unit tests.
