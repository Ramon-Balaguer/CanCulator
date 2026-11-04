# ADR 0012: App reset with a prior copy and sum confirmation

## Status

Accepted (reconstructed from the repository history, October 2026).

## Context

The reset deletes all the data on the phone. An accidental tap must not be able to do it, and the user must have a copy before losing the data.

## Decision

- Before deleting, a JSON copy is downloaded.
- Then the user is asked for the sum of two single-digit numbers, generated in `js/logica/reinicio.js`. Only a correct answer continues.
- The check does not touch the database; the deletion is a separate step.

## Consequences

- A reset requires two deliberate actions and leaves a copy behind.
- It is not a protection against someone who wants to delete the data on purpose; it protects against accidental taps.
