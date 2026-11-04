# ADR 0010: TDD y una rama por cambio

## Estado

Aceptada (reconstruida de `CLAUDE.md`, octubre de 2026).

## Contexto

El proyecto lo mantiene una persona con ayuda de agentes de código. Hace falta que cada cambio sea verificable y que `main` siempre esté desplegable.

## Decisión

- **TDD**: antes de tocar código de producto, se escribe el test que falla. Unitario en `tests/unit`; si es comportamiento de pantalla, e2e en `tests/e2e`. Luego se implementa hasta que pase.
- Antes de entregar se corren los unitarios y los e2e.
- **Una rama por desarrollo**, nueva desde `main`. Nunca se trabaja en la rama actual.
- Cada desarrollo acaba con commit, push, PR, merge a `main` y borrado de la rama (remota y local).

## Consecuencias

- Cada cambio tiene su test; los errores de regresión se detectan antes del despliegue.
- El flujo es más largo para cambios pequeños, pero deja un historial claro de PRs.
- El CI (`.github/workflows/deploy.yml`) vuelve a correr las pruebas en cada PR.
