'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {getSession, updateSession} from '@/lib/session';
import {useVialCapture} from '@/lib/useVialCapture';
import {checkVialCondition} from '@/lib/vialCondition';
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

export default function After() {
  useRequireProfessional();
  const r = useRouter();
  const [photo, setPhoto] = useState('');
  const [beforeLot, setBeforeLot] = useState('');
  const [beforeGtin, setBeforeGtin] = useState('');
  const [beforeExpiry, setBeforeExpiry] = useState('');
  const [mismatch, setMismatch] = useState('');
  const [conditionMsg, setConditionMsg] = useState('');
  const vial = useVialCapture();

  useEffect(() => {
    const s = getSession();
    setBeforeLot(s.beforeLot || '');
    setBeforeGtin(s.beforeGtin || '');
    setBeforeExpiry(s.beforeExpiry || '');
  }, []);

  async function done(p: string) {
    setPhoto(p);
    updateSession({afterPhoto: p});
    setMismatch('');
    setConditionMsg('');

    const [data, condition] = await Promise.all([vial.capture(p), checkVialCondition(p).catch(() => null)]);

    // Verificación de consistencia: si la foto ANTES ya había leído
    // lote/GTIN/vencimiento del vial, comparamos contra lo leído ahora
    // para avisar si parece ser un vial distinto (por ejemplo, si se
    // pesó el vial equivocado por error). El detalle definitivo para
    // auditoría se recalcula en la pantalla de resumen.
    const lotMismatch = Boolean(beforeLot && data.lot && data.lot !== beforeLot);
    const gtinMismatch = Boolean(beforeGtin && data.gtin && data.gtin !== beforeGtin);
    const expiryMismatch = Boolean(beforeExpiry && data.expiry && data.expiry !== beforeExpiry);
    if (lotMismatch || gtinMismatch || expiryMismatch) {
      setMismatch(
        `Los datos leídos ahora no coinciden con los de la foto ANTES ` +
          `(lote: ${beforeLot || '—'} → ${data.lot || '—'}, ` +
          `GTIN: ${beforeGtin || '—'} → ${data.gtin || '—'}, ` +
          `vencimiento: ${beforeExpiry || '—'} → ${data.expiry || '—'}). Verifica que sea el mismo vial.`
      );
    }

    if (condition && condition.looksOpened === false) {
      setConditionMsg(
        condition.notes || 'El vial en esta foto no muestra señales claras de haber sido abierto o alterado.'
      );
    }

    updateSession({
      afterProduct: data.product || undefined,
      afterGtin: data.gtin || undefined,
      afterLot: data.lot || undefined,
      afterExpiry: data.expiry || undefined,
      vialLooksOpened: condition ? condition.looksOpened : undefined,
      vialConditionConfidence: condition ? condition.confidence : undefined,
      vialConditionNotes: condition ? condition.notes : undefined,
    });
  }

  function confirm() {
    const n = Number(vial.weight.replace(',', '.'));
    updateSession({afterWeight: Number.isFinite(n) ? n : undefined});
    r.push('/complete');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={6} stepLabel="Evidencia después" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-4">
          <h1 className="text-2xl font-bold text-slate-900">Registrar vial después</h1>
          <p className="mt-2 text-sm text-slate-500">Vuelve a colocar el vial en la balanza y captura una imagen equivalente.</p>
        </div>

        <CameraCapture onCapture={done} guideText="Vial + DataMatrix + display de báscula" aspect="ancho" />

        {vial.processing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
            Leyendo datos del vial y báscula…
          </div>
        )}

        {mismatch && (
          <div className="mt-4 flex gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
              !
            </div>
            <div>
              <p className="font-bold text-red-950">Los datos del vial no coinciden</p>
              <p className="mt-1 text-sm text-red-900">{mismatch}</p>
            </div>
          </div>
        )}

        {conditionMsg && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <span className="font-bold text-amber-700">!</span>
            <div>
              <p className="font-semibold text-amber-950">El vial no parece abierto</p>
              <p className="mt-1 text-sm text-amber-900">{conditionMsg}</p>
            </div>
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

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-semibold text-slate-900">Peso DESPUÉS</p>
              <p className="mt-1 text-xs text-slate-500">Detectado automáticamente · puedes corregirlo</p>
            </div>
            <div className="flex items-baseline gap-1">
              <input
                value={vial.weight}
                onChange={(e) => vial.setWeight(e.target.value)}
                placeholder="0.000"
                inputMode="decimal"
                className="w-28 bg-transparent text-right text-4xl font-bold tabular-nums text-slate-900 outline-none"
              />
              <span className="font-semibold text-slate-600">g</span>
            </div>
          </div>
          {vial.weightMsg && <p className="mt-3 text-sm text-amber-700">{vial.weightMsg}</p>}
          {vial.weightReading && (
            <p className="mt-2 text-xs text-slate-400">
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
          Cerrar sesión
        </button>
      </main>
    </div>
  );
}
