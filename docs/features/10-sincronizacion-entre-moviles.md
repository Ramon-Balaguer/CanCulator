# Sincronización entre móviles

Dos móviles en la misma red comparten un inventario. Cada cambio se envía al otro móvil en cuanto se produce; si uno está sin conexión, los cambios esperan en una cola y se envían al reconectar.

- **Main**: el móvil que crea la sala. **Cliente**: el que se une con el código y la password.
- La sala tiene un código de seis caracteres. El QR contiene el código y la password, así que escanearlo rellena los dos campos.
- Al conectar, cada móvil envía su estado completo (productos, lotes y ajustes) y fusiona el del otro: gana el registro con fecha más reciente.
- La sala se reabre sola al arrancar la app. El cliente reintenta cada segundo si el main no está, y si la conexión WebRTC se atasca durante 20 segundos, empieza de nuevo.
- En Ajustes se ve cuántos móviles están conectados (**⇄ N conectados**).
- Cerrar la sala (main) o salir de ella (cliente). Cada móvil conserva su copia de los datos.
- La password es el único cierre: quien la conozca puede leer y cambiar el inventario.

Detalle de los pasos y de los mensajes de error: [README, sección Sync between phones](../../README.md#sync-between-phones). Pruebas manuales: [`mobile-checklist.md`](../mobile-checklist.md), fase 4.

Decisiones: [ADR 0004](../adr/0004-sincronizacion-p2p-webrtc.md), [ADR 0005](../adr/0005-sin-servidor-ni-hoja-de-calculo.md), [ADR 0006](../adr/0006-conflictos-gana-el-cambio-mas-reciente.md).
