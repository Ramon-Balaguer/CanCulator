# ADR 0006: Conflictos: gana el cambio más reciente

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026).

## Contexto

Dos móviles pueden cambiar el mismo registro sin conexión entre sí. Hace falta una regla simple y predecible, y que las operaciones no se pierdan ni se apliquen dos veces.

## Decisión

- Cada cambio local crea una operación (`crear`, `editar`, `consumir`, `reponer`, `borrar`) con su fecha y el dispositivo. Los cambios offline esperan en una cola.
- Al aplicar una operación recibida, gana el registro con fecha más reciente. Las operaciones ya aplicadas se recuerdan por id (hasta 5000) para no repetirlas.
- Al conectar, cada móvil envía su estado completo (productos, lotes y ajustes) y fusiona el del otro, para que no quede ningún registro sin llegar.
- Los ajustes (categorías, ubicaciones) se guardan por clave con la misma regla.

## Consecuencias

- La regla es fácil de explicar: «el último cambio gana».
- Dos cambios simultáneos al mismo campo se resuelven sin preguntar; el usuario lo ve en el resultado, no en un aviso.
- Las reglas viven en `js/logica/peer-sync.js` sin DOM ni red, y se prueban con `node --test`.
