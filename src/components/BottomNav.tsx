'use client';
import Link from 'next/link';

export default function BottomNav() {
  return (
    <nav className="grid grid-cols-3 gap-2 border-t border-slate-200 bg-white p-3">
      <Link
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
        href="/session"
      >
        Sesión
      </Link>
      <Link
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
        href="/nfc"
      >
        NFC
      </Link>
      <Link
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
        href="/"
      >
        Inicio
      </Link>
    </nav>
  );
}
