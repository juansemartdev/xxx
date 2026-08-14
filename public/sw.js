// Service worker mínimo para que ChainDose se pueda instalar como PWA y
// abra en modo standalone (pantalla completa, sin la barra del navegador).
//
// Estrategia deliberadamente simple: cachea el "app shell" (la página raíz
// y el manifiesto/íconos) para que la app abra rápido incluso con mala
// señal, pero NO cachea agresivamente rutas dinámicas ni llamadas a /api —
// esta es una app que depende de datos en vivo (pacientes, atenciones,
// verificación biométrica), así que preferimos red primero y solo caemos
// al caché si no hay conexión.
const CACHE = 'chaindose-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;
  // Solo interceptamos navegaciones GET normales (cargar una pantalla).
  // Todo lo demás (POST/PATCH a /api, streams de cámara, etc.) pasa
  // directo a la red sin pasar por el service worker.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});
