# Checklist de pruebas en móvil

Hazlas en un Android con Chrome y en un iPhone con Safari. Marca cada casilla en los dos.
Si la cámara o el modo sin conexión fallan en el iPhone, avisa antes de empezar la fase siguiente.

URL pública: https://ramon-balaguer.github.io/survivor-resources/

## Fin de fase 1: base

- [ ] La URL pública abre y muestra «Inventario de casa» y, abajo, «Versión» con 7 caracteres (no «desarrollo»).
- [ ] Android: menú de Chrome → «Instalar aplicación» o «Añadir a pantalla de inicio». El icono es una lata sobre fondo verde.
- [ ] iPhone: en Safari, Compartir → «Añadir a pantalla de inicio». Al abrirla desde el icono, no se ve la barra de Safari.
- [ ] Abre la app instalada, cierra la app del todo, activa el modo avión y vuelve a abrirla: carga y dice «Sin conexión».
- [ ] Desactiva el modo avión: vuelve a decir «En línea».
- [ ] Desde la app instalada, abre «Prueba de cámara y código de barras» → «Abrir cámara»: el navegador pide permiso, se ve la cámara trasera y, al apuntar al código de una lata de casa, sale el número con «dígito de control correcto».
- [ ] En la misma página, «Leer de una foto»: haz una foto al código y sale el mismo número.
- [ ] Con el modo avión activado, la página de prueba de cámara abre y lee un código (no necesita internet).
- [ ] Si algo de la cámara falla, haz una captura de la sección «Este dispositivo» y del mensaje de error.

## Fin de fase 2: app local

- [ ] Alta de un lote con foto hecha con la cámara: la foto se ve en la ficha.
- [ ] Lectura de un código de barras real (una lata de casa) con la cámara: el número sale bien.
- [ ] Consumir 1 unidad desde Caducidad: el stock baja y el lote que caduca antes es el propuesto.
- [ ] En modo avión, dar de alta un lote y consumir otro; cerrar la app del todo y volver a abrirla: los cambios siguen.
- [ ] Al día siguiente, abrir la app: los datos siguen (sobre todo en iPhone).

## Fin de fase 4: sincronización

- [ ] Pegar en Ajustes la URL de Apps Script y el token, y pulsar «Sincronizar ahora»: el estado dice que se ha sincronizado.
- [ ] Dar de alta un lote en un móvil y sincronizar los dos: aparece en el otro y en la Google Sheet.
- [ ] Los dos móviles en modo avión consumen 1 unidad del mismo lote; quitar el modo avión y sincronizar los dos: el lote ha bajado 2.
- [ ] La foto de un lote nuevo aparece en la carpeta `inventario-fotos` de Drive.
- [ ] Una semana después, en el iPhone: los datos y la cola pendiente siguen ahí.
