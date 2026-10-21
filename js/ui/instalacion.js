// Instalación de la app en la pantalla de inicio.
// Android/Chrome avisa con el evento "beforeinstallprompt" y se puede lanzar desde un botón.
// iPhone/Safari no tiene ese evento: la instalación es manual (menú Compartir).

let eventoInstalar = null;
const suscriptores = new Set();

// Se llama una vez al arrancar, para no perder el evento aunque llegue antes de abrir Ajustes.
export function iniciarCapturaInstalacion() {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    eventoInstalar = evento;
    suscriptores.forEach((avisar) => avisar());
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalar = null;
    suscriptores.forEach((avisar) => avisar());
  });
}

export function suscribirInstalacion(avisar) {
  suscriptores.add(avisar);
  return () => suscriptores.delete(avisar);
}

export function puedeInstalarConBoton() {
  return eventoInstalar !== null;
}

// Lanza el aviso de instalación del navegador (Android/Chrome).
export async function instalarApp() {
  if (!eventoInstalar) return 'no-disponible';
  eventoInstalar.prompt();
  const { outcome } = await eventoInstalar.userChoice;
  eventoInstalar = null;
  return outcome;
}

export function estaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function esIOS() {
  const nav = window.navigator;
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}
