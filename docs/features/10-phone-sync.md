# Phone sync

Two phones on the same network share one inventory. Each change is sent to the other phone as soon as it happens. If a phone is offline, its changes wait in a queue and are sent when it reconnects.

- **Main**: the phone that creates the room. **Client**: the phone that joins with the code and password.
- The room has a six-character code. The QR code contains the code and the password, so scanning it fills in both fields.
- On connect, each phone sends its full state (products, lots and settings) and merges the other one's: the record with the most recent date wins.
- The room reopens by itself when the app starts. The client retries every second while the main is not available, and if the WebRTC connection stalls for 20 seconds, it starts again.
- Ajustes shows how many phones are connected (**⇄ N conectados**).
- The main closes the room (**Cerrar sala**); a client leaves it (**Salir de la sala**). Each phone keeps its own copy of the data.
- The password is the only lock: anyone who knows it can read and change the inventory.

Step-by-step instructions and error messages: [README, "Sync between phones"](../../README.md#sync-between-phones). Manual tests: [`mobile-checklist.md`](../mobile-checklist.md), phase 4.

Decisions: [ADR 0004](../adr/0004-p2p-sync-webrtc.md), [ADR 0005](../adr/0005-no-apps-script-or-spreadsheet.md), [ADR 0006](../adr/0006-conflicts-latest-change-wins.md).
