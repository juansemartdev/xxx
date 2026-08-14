'use client';
import {useRouter} from 'next/navigation';
import Header from '@/components/Header';
import {getSession, updateSession} from '@/lib/session';

export default function Session() {
  const r = useRouter();
  const registered = getSession().patient;

  function start() {
    if (!registered) updateSession({patient: 'Paciente de prueba'});
    r.push('/verificar-paciente');
  }

  return (
    <>
      <Header step="Nueva administración" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">2 · Paciente</div>
          <h1 className="text-2xl font-bold mt-2">Identificar paciente</h1>
          <p className="sub">
            {registered
              ? 'Usando el paciente registrado por cédula.'
              : 'V1: paciente de prueba (usa "Registro" en el inicio para identificar por cédula).'}
          </p>
          <div className="status text-green-700 bg-green-50 mt-4">
            <span className="dot" />
            {registered || 'Paciente de prueba'}
          </div>
        </div>
        <button className="btn primary" onClick={start}>
          Continuar con verificación de identidad
        </button>
      </div>
    </>
  );
}
