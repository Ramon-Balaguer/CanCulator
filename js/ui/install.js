// Instalación de la app en la pantalla de inicio.
// Android/Chrome avisa con el evento "beforeinstallprompt" y se puede lanzar desde un botón.
// iPhone/Safari no tiene ese evento: la instalación es manual (menú Compartir).

let installEvent = null;
const subscribers = new Set();

// Se llama una vez al arrancar, para no perder el evento aunque llegue antes de abrir Ajustes.
export function startInstallCapture() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    subscribers.forEach((notifyAll) => notifyAll());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    subscribers.forEach((notifyAll) => notifyAll());
  });
}

export function subscribeInstall(notifyAll) {
  subscribers.add(notifyAll);
  return () => subscribers.delete(notifyAll);
}

export function canInstallWithButton() {
  return installEvent !== null;
}

// Lanza el aviso de instalación del navegador (Android/Chrome).
export async function installApp() {
  if (!installEvent) return 'no-disponible';
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  return outcome;
}

export function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const nav = window.navigator;
  return /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}
