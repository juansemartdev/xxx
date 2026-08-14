'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import Header from '@/components/Header';
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
    <>
      <Header step="Trazabilidad digital de medicamentos" />
      <div className="content space-y-5">
        <div className="card">
          <p className="sub mt-2">Cargando…</p>
        </div>
      </div>
    </>
  );
}
