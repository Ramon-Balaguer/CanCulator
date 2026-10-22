# Reglas de trabajo en este repo

Estas reglas las pide el dueño del proyecto. Son obligatorias para cualquier cambio.

## TDD: test en rojo primero

1. Antes de tocar código de producto, escribe el test que falla (rojo). Unitario en `tests/unit`; si es comportamiento de pantalla, e2e en `tests/e2e`.
2. Ejecútalo y comprueba que falla por la razón correcta.
3. Implementa hasta que pase (verde).
4. Corre los unitarios y los e2e antes de entregar.

## Entrega: producción, merge y limpieza

Cada desarrollo acaba así, sin preguntar:

1. Rama nueva desde `main`.
2. Commit, push y PR.
3. Merge de la PR a `main` (el push a `main` despliega GitHub Pages).
4. Borrar la rama, la remota y la local.

El despliegue de `apps-script/Code.gs` es manual, en la cuenta de Google del dueño. Avisa siempre de ello cuando cambie ese archivo.
