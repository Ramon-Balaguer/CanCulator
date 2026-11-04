# ADR 0014: Volumen en ml para bebidas, tomate, salsas y aceites

## Estado

Aceptada (reconstruida del historial del repositorio, octubre de 2026). Amplía la decisión de usar volumen en ml para bebidas (commit `d3d8dc7`).

## Contexto

El peso en gramos sirve para productos sólidos. Un litro de agua o de aceite no se describe bien en gramos, y Open Food Facts trae la cantidad del producto en litros o centilitros (33 cl, 1,5 l).

## Decisión

- Para aguas y bebidas el formulario pide volumen en ml (`volumen_ml`). Tomate, salsas, aceites y condimentos también.
- La función `usaVolumen` decide qué campo se muestra según la categoría.
- Los sólidos siguen con peso en gramos.

## Consecuencias

- Las estadísticas suman litros para bebidas y volumen para las salsas, y peso para el resto.
- Un producto sin el dato correspondiente no suma en esos totales.
