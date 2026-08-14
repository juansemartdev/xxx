'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {getSession, updateSession} from '@/lib/session';
import {useVialCapture} from '@/lib/useVialCapture';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

function ConfidenceBadge({level}: {level?: string}) {
  if (level === 'alta') {
    return (
      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
        Confianza alta
      </span>
    );
  }
  if (level === 'media') {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        Confianza media
      </span>
    );
  }
  if (level === 'baja') {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Confianza baja</span>
    );
  }
  return null;
}

export default function Before() {
  useRequireProfessional();
  const r = useRouter();
  const [photo, setPhoto] = useState('');
  const [atencion, setAtencion] = useState<{product?: string; lot?: string; expiry?: string} | null>(null);
  const vial = useVialCapture();

  useEffect(() => {
    const s = getSession();
    if (s.atencionId) {
      setAtencion({product: s.atencionProduct, lot: s.atencionLot, expiry: s.atencionExpiry});
    }
  }, []);

  async function done(p: string) {
    setPhoto(p);
    updateSession({beforePhoto: p});
    const data = await vial.capture(p);
    updateSession({
      beforeProduct: data.product || undefined,
      beforeGtin: data.gtin || undefined,
      beforeLot: data.lot || undefined,
      beforeExpiry: data.expiry || undefined,
    });
  }

  function confirm() {
    const n = Number(vial.weight.replace(',', '.'));
    updateSession({
      beforeWeight: Number.isFinite(n) ? n : undefined,
      beforeProduct: vial.product || undefined,
      beforeGtin: vial.gtin || undefined,
      beforeLot: vial.lot || undefined,
      beforeExpiry: vial.expiry || undefined,
    });
    r.push('/after');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={5} stepLabel="Evidencia antes" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-5">
          <p className="text-sm font-semibold text-teal-700">Paso 5 de 7 · Evidencia ANTES</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Registra el estado antes</h1>
          <p className="mt-2 text-sm text-slate-500">
            Coloca el vial sobre una balanza convencional. La foto debe mostrar el vial, su DataMatrix y el
            display de la báscula.
          </p>
        </div>

        {atencion && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">Prescrito (atención seleccionada)</p>
            <p className="mt-1 text-sm text-slate-500">
              {atencion.product}
              {atencion.lot && <> · Lote: {atencion.lot}</>}
              {atencion.expiry && <> · Vence: {atencion.expiry}</>}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Solo informativo — compara contra lo que leas del vial físico abajo.
            </p>
          </div>
        )}

        <CameraCapture onCapture={done} guideText="Vial + DataMatrix + display de báscula" aspect="ancho" />

        {vial.processing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
            Leyendo datos del vial y báscula…
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">Datos detectados</h2>
            <ConfidenceBadge level={vial.confidence} />
          </div>

          {vial.codeMsg && <p className="mb-2 text-sm text-amber-600">{vial.codeMsg}</p>}
          {vial.rawCode && (
            <p className="mb-2 break-all text-xs text-slate-400">
              Contenido crudo del código: <span className="font-mono">{vial.rawCode}</span>
            </p>
          )}

          <div className="space-y-2">
            <input
              value={vial.product}
              onChange={(e) => vial.setProduct(e.target.value)}
              placeholder="Producto"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <input
              value={vial.gtin}
              onChange={(e) => vial.setGtin(e.target.value)}
              placeholder="GTIN"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <input
              value={vial.lot}
              onChange={(e) => vial.setLot(e.target.value)}
              placeholder="Lote"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
            <input
              value={vial.expiry}
              onChange={(e) => vial.setExpiry(e.target.value)}
              placeholder="Vencimiento (AAAA-MM-DD)"
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-teal-900">Peso</p>
              <p className="mt-1 text-xs text-teal-800">Detectado automáticamente · puedes corregirlo</p>
            </div>
            <div className="flex items-baseline gap-1">
              <input
                value={vial.weight}
                onChange={(e) => vial.setWeight(e.target.value)}
                placeholder="0.000"
                inputMode="decimal"
                className="w-28 bg-transparent text-right text-4xl font-bold tabular-nums text-teal-950 outline-none"
              />
              <span className="font-semibold text-teal-800">g</span>
            </div>
          </div>
          {vial.weightMsg && <p className="mt-3 text-sm text-amber-700">{vial.weightMsg}</p>}
          {vial.weightReading && (
            <p className="mt-2 text-xs text-teal-800/70">
              Lectura del display: <span className="font-mono">{vial.weightReading}</span> — verifica que coincida
              con la báscula antes de continuar.
            </p>
          )}
        </div>

        <button
          disabled={!photo || !vial.weight}
          className="mt-4 min-h-12 w-full rounded-xl bg-teal-700 px-5 font-semibold text-white shadow-sm disabled:opacity-40 active:scale-[0.98]"
          onClick={confirm}
        >
          Confirmar ANTES
        </button>
      </main>
    </div>
  );
}
