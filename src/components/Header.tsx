'use client';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {clearSession, getSession} from '@/lib/session';

export default function Header({step}: {step?: string}) {
  const r = useRouter();
  // Se lee en useEffect (no en el primer render) porque localStorage no
  // existe en el servidor — evita un mismatch de hidratación en Next.js.
  const [professional, setProfessional] = useState<string | undefined>(undefined);

  useEffect(() => {
    setProfessional(getSession().professional);
  }, []);

  function cerrarSesion() {
    clearSession();
    r.push('/login');
  }

  return (
    <header className="px-5 pt-6 pb-3">
      <div className="flex items-center justify-between">
        <div className="brand">ChainDose</div>
        {professional && (
          <button onClick={cerrarSesion} className="text-xs text-slate-400 underline">
            {professional} · Cerrar sesión
          </button>
        )}
      </div>
      {step && <div className="sub">{step}</div>}
    </header>
  );
}
