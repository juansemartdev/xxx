'use client';
import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {clearSession, getSession} from '@/lib/session';

type Props = {
  // Paso actual dentro del flujo de 6 pasos (1-6). Si se omite, no se
  // muestra la barra de progreso (se usa en pantallas fuera del flujo
  // numerado, como splash, login o el resumen final).
  stepIndex?: number;
  // Sufijo del paso, p.ej. "1b" (verificación, sub-paso de "1 · Paciente").
  stepSuffix?: string;
  // Nombre de la sección para la barra de progreso, p.ej. "Paciente".
  stepLabel?: string;
  totalSteps?: number;
};

export default function Header({stepIndex, stepSuffix, stepLabel, totalSteps = 6}: Props) {
  const r = useRouter();
  // Se lee en useEffect (no en el primer render) porque localStorage no
  // existe en el servidor — evita un mismatch de hidratación en Next.js.
  const [professional, setProfessional] = useState<string | undefined>(undefined);

  // El header es "fixed" (no "sticky") y va acompañado de un div espaciador
  // del mismo alto justo debajo, medido en vivo con ResizeObserver. Con
  // "sticky" vimos, con video, que en algunos navegadores móviles (rebote
  // de scroll / overscroll) el header queda "adelantado" un instante
  // respecto al contenido real y el título de la pantalla queda tapado
  // parcialmente por el header. Con "fixed" + espaciador medido, el
  // contenido siempre reserva exactamente el espacio real del header,
  // sin depender de cómo cada navegador recalcula el sticky durante el
  // scroll.
  const headerRef = useRef<HTMLElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    setProfessional(getSession().professional);
  }, []);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stepIndex, stepSuffix, stepLabel, professional]);

  function cerrarSesion() {
    clearSession();
    r.push('/login');
  }

  const stepText = stepIndex ? `Paso ${stepIndex}${stepSuffix || ''} de ${totalSteps}` : undefined;

  return (
    <>
      <header
        ref={headerRef}
        className="safe-top fixed inset-x-0 top-0 z-20 mx-auto w-full max-w-[520px] border-b border-slate-200 bg-white"
      >
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo-wordmark.png" alt="Probattio" className="h-6 w-auto" />
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
      <div style={{height: headerHeight}} aria-hidden="true" />
    </>
  );
}
