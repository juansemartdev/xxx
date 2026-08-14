'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {getSession} from '@/lib/session';

// La primera pantalla de la app siempre es el login del profesional: si ya
// hay uno autenticado en este dispositivo (localStorage), lo mandamos
// directo a identificar/atender pacientes sin pedirle login de nuevo; si
// no, al login. Ya no hay accesos sueltos como "Registro (escanear
// cédula)" desde aquí — todo el flujo de paciente exige login primero.
export default function Home() {
  const r = useRouter();
  useEffect(() => {
    r.replace(getSession().professional ? '/session' : '/login');
  }, [r]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-700 text-2xl font-bold text-white shadow-lg">
          CD
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">ChainDose</h1>
        <p className="mt-2 text-sm text-slate-500">Trazabilidad digital de medicamentos</p>
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          Cargando…
        </div>
      </main>
    </div>
  );
}
