# ADR 0014: Volume in ml for drinks, tomato, sauces and oils

## Status

Accepted (reconstructed from the repository history, October 2026). Extends the decision to use volume in ml for drinks (commit `d3d8dc7`).

## Context

Weight in grams suits solid products. A litre of water or oil is not well described in grams, and Open Food Facts gives the product quantity in litres or centilitres (33 cl, 1.5 l).

## Decision

- For water and drinks the form asks for the volume in ml (`volumen_ml`). Tomato, sauces, oils and condiments do too.
- The function `usaVolumen` decides which field is shown for each category.
- Solid products keep weight in grams.

## Consequences

- Statistics add litres for drinks and volume for sauces, and weight for the rest.
- A product without the corresponding value adds nothing to those totals.
