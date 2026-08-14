import type {Metadata, Viewport} from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Probattio',
  description: 'Trazabilidad digital de administración de medicamentos',
  manifest: '/manifest.webmanifest',
  // Permite "Agregar a pantalla de inicio" en iOS Safari con apariencia de
  // app nativa (sin barra de Safari) — el manifest.webmanifest ya cubre
  // Android/Chrome, pero iOS necesita estas etiquetas propias además.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Probattio',
  },
  icons: {
    icon: [
      {url: '/icons/icon.svg', type: 'image/svg+xml'},
      {url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png'},
      {url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png'},
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewportFit "cover" + los helpers .safe-top/.safe-bottom en
  // globals.css evitan que el contenido quede debajo del notch/isla
  // dinámica cuando la app corre en pantalla completa (modo standalone).
  viewportFit: 'cover',
  themeColor: '#0F766E',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es">
      <body>
        <main className="app-shell">
          <div className="phone safe-bottom">{children}</div>
        </main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
