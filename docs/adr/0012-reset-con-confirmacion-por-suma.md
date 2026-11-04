# ADR 0012: Reset de la app con copia previa y confirmación por suma

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

El reset borra todos los datos del móvil. Un toque accidental no puede hacerlo, y el usuario tiene que tener una copia antes de perderlos.

## Decisión

- Antes de borrar, se descarga una copia JSON.
- Después se pide una suma de dos números de un dígito, generada en `js/logica/reinicio.js`. Solo una respuesta correcta continúa.
- La comprobación no toca la base de datos; el borrado es un paso separado.

## Consecuencias

- Un reset requiere dos acciones deliberadas y deja una copia.
- No es una protección frente a una persona que quiera borrar a propósito; sirve contra toques accidentales.
