'use client';
import {useEffect} from 'react';

// Registra el service worker (public/sw.js) para que ChainDose sea
// instalable como PWA. Sin esto, la mayoría de navegadores Android/Chrome
// no ofrecen "Agregar a pantalla de inicio" aunque el manifest esté bien
// configurado.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Si falla (por ejemplo en desarrollo sin HTTPS), la app sigue
        // funcionando normalmente, solo sin capacidad offline/instalación.
      });
    }
  }, []);
  return null;
}
