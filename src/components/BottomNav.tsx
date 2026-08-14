'use client';
import Link from 'next/link';
export default function BottomNav(){return <nav className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3"><Link className="btn secondary" href="/session">Sesión</Link><Link className="btn secondary" href="/nfc">NFC</Link><Link className="btn secondary" href="/">Inicio</Link></nav>}
