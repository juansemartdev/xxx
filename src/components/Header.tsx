'use client';
import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {clearSession, getSession} from '@/lib/session';

type Props = {
  // Paso actual dentro del flujo de 7 pasos (1-7). Si se omite, no se
  // muestra la barra de progreso (se usa en pantallas fuera del flujo
  // numerado, como splash o el resumen final).
  stepIndex?: number;
  // Sufijo del paso, p.ej. "b" para "2b" (verificación, sub-paso de
  // "2 · Paciente").
  stepSuffix?: string;
  // Nombre de la sección para la barra de progreso, p.ej. "Paciente".
  stepLabel?: string;
  totalSteps?: number;
};

export default function Header({stepIndex, stepSuffix, stepLabel, totalSteps = 7}: Props) {
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

  const stepText = stepIndex ? `Paso ${stepIndex}${stepSuffix || ''} de ${totalSteps}` : undefined;

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white">
              CD
            </div>
            <span className="text-lg font-bold text-slate-900">ChainDose</span>
          </div>
          {(professional || stepText) && (
            <p className="mt-1 text-xs text-slate-500">
              {professional}
              {professional && stepText && ' · '}
              {stepText}
            </p>
          )}
        </div>
        {professional && (
          <button onClick={cerrarSesion} className="rounded-lg px-2 py-2 text-sm font-medium text-slate-500">
            Cerrar sesión
          </button>
        )}
      </div>

      {stepIndex && stepLabel && (
        <div className="mx-auto max-w-xl px-4 pb-3">
          <div className="mb-2 flex justify-between text-xs font-semibold">
            <span className="text-teal-700">{stepText}</span>
            <span className="text-slate-500">{stepLabel}</span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({length: totalSteps}, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < stepIndex ? 'bg-teal-700' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
