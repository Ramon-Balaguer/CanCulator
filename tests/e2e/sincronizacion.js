// Pasos de Ajustes para sincronizar dos móviles: el main crea la sala y el cliente entra con el QR o el código.
// Los dos móviles de una prueba usan la misma password de sincronización.
export const PASSWORD_PRUEBA = 'token-de-prueba';

export async function abrirAjustes(page) {
  await page.goto('./');
  await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Ajustes' }).click();
}

// En el main: guarda la password, crea la sala y devuelve su código.
export async function crearMain(page, password = PASSWORD_PRUEBA) {
  const main = page.getByTestId('crear-main');
  await main.getByLabel('Password de sincronización').fill(password);
  await main.getByRole('button', { name: 'Guardar y crear sala' }).click();
  return main.getByTestId('codigo-sala').textContent();
}

// En el cliente: abre el escáner, pone la password y el código, y guarda.
export async function entrarComoCliente(page, codigo, password = PASSWORD_PRUEBA) {
  await page.getByTestId('crear-cliente').getByRole('button', { name: 'Escanear QR' }).click();
  const escaner = page.getByRole('dialog', { name: 'Escanear QR de la sala' });
  await escaner.getByLabel('Password de sincronización').fill(password);
  await escaner.getByLabel('Código de la sala').fill(codigo);
  await escaner.getByRole('button', { name: 'Guardar', exact: true }).click();
}
