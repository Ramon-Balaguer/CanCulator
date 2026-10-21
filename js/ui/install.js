// Installation of the app on the home screen.
// Android/Chrome fires the "beforeinstallprompt" event and it can be triggered from a button.
// iPhone/Safari has no such event: installation is manual (Share menu).

let installEvent = null;
const subscribers = new Set();

// Called once at startup, so the event is not lost even if it arrives before opening Settings.
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

// Launches the browser install prompt (Android/Chrome).
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
