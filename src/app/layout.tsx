import './globals.css';
export const metadata={title:'ChainDose',description:'Digital chain of custody for medication administration',manifest:'/manifest.webmanifest'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body><main className="app-shell"><div className="phone">{children}</div></main></body></html>}
