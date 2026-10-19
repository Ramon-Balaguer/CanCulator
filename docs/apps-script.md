# Apps Script: puesta en marcha (una sola vez)

Lo hace la cuenta de Google que es dueña de la hoja. El código está en `apps-script/Code.gs`.

## 1. Pegar el código en la hoja

1. Abre la Google Sheet compartida.
2. Menú **Extensiones → Apps Script**. Se abre el editor, ya ligado a la hoja.
3. Borra lo que haya en `Código.gs` y pega el contenido de `apps-script/Code.gs`.
4. Guarda (icono de disquete).

No hace falta crear las pestañas a mano: el script las crea la primera vez (Productos, Lotes, Configuracion, Dispositivos, Aplicadas).

## 2. Guardar el token

El token es una contraseña compartida entre los móviles y el script. Genera uno largo y no lo subas a GitHub.

1. Genera un token, por ejemplo con `openssl rand -hex 24` en una terminal.
2. En el editor de Apps Script: icono de engranaje (**Configuración del proyecto**) → **Propiedades del script** → **Añadir propiedad**.
3. Nombre: `TOKEN`. Valor: el token generado. Guarda.

## 3. Desplegar como aplicación web

1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Ejecutar como: **Yo**.
4. Quién tiene acceso: **Cualquier usuario**. (Sin esto, los móviles no pueden enviar nada.)
5. Pulsa **Implementar** y acepta los permisos (Hojas de cálculo y Drive).
6. Copia la **URL de la aplicación web**. Termina en `/exec`.

Cada vez que cambies `Code.gs`, hay que hacer **Implementar → Gestionar implementaciones → editar → Nueva versión**. Si no, el servidor sigue con el código anterior.

## 4. Comprobar la conexión

1. Abre `prueba-sync.html` en el móvil (la URL de la app, seguida de `prueba-sync.html`).
2. Pega la URL `/exec` y el token.
3. Pulsa **Enviar ping**. Debe salir `OK · servidor versión 1`.

Si sale otra cosa, ver la sección de errores abajo.

## 5. Pasar los datos a cada móvil

En **Ajustes** de la app, en cada móvil: URL de Apps Script y token. Luego **Guardar** y **Sincronizar ahora**.

## Errores habituales

| Lo que sale | Causa probable |
| --- | --- |
| `Token no válido` | El token de la app no coincide con la propiedad `TOKEN` del script. |
| `El script no tiene token configurado` | Falta la propiedad `TOKEN` (paso 2). |
| `No llegó ninguna respuesta` | La implementación no es de «Cualquier usuario», o la URL está mal copiada. |
| `La respuesta no es JSON` | Se ha copiado la URL de la hoja, no la de la aplicación web (`/exec`). |
| La versión no cambia tras editar | Falta publicar una **nueva versión** de la implementación. |
