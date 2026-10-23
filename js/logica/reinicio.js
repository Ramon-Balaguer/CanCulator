// Comprobación antes de resetear la app: una suma de dos números de un dígito.
// Evita que un toque accidental borre todo. No toca la base de datos.

const digito = (aleatorio) => Math.floor(aleatorio() * 9) + 1;

export function preguntaDeSuma(aleatorio = Math.random) {
  const a = digito(aleatorio);
  const b = digito(aleatorio);
  return { a, b, suma: a + b };
}

export function esRespuestaCorrecta(pregunta, respuesta) {
  const texto = String(respuesta).trim();
  return /^\d+$/.test(texto) && Number(texto) === pregunta.suma;
}
