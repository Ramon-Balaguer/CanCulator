# Backup and reset

- **Exportar JSON** (export JSON, in Ajustes → Copia de seguridad) downloads a copy of the inventory, photos included. On iPhone it appears in Files.
- **Importar JSON** merges a copy with the data on the phone. The most recent version of each record wins, so importing the same file twice does not duplicate anything.
- **Resetear la app** (reset): before deleting anything, it downloads a JSON copy, then asks you to solve a sum of two single-digit numbers (for example, 3 + 7). Only a correct answer deletes all the data on the phone. The sum protects against accidental taps.

Related: [ADR 0012](../adr/0012-reset-with-sum-confirmation.md).
