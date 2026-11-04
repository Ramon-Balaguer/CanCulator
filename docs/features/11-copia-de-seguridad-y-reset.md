# Copia de seguridad y reset

- **Exportar JSON** (Ajustes → Copia de seguridad) descarga una copia del inventario, con fotos. En iPhone aparece en Archivos.
- **Importar JSON** fusiona una copia con los datos del móvil. Gana la versión más reciente de cada registro, así que importar dos veces el mismo fichero no duplica nada.
- **Resetear la app**: antes de borrar nada descarga una copia JSON, y después pide resolver una suma de dos números de un dígito (por ejemplo, 3 + 7). Solo si la respuesta es correcta borra todos los datos del móvil. La suma evita un toque accidental.

Relacionado: [ADR 0012](../adr/0012-reset-con-confirmacion-por-suma.md).
