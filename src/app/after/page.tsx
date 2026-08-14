'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {getSession, updateSession} from '@/lib/session';
import {useVialCapture} from '@/lib/useVialCapture';
import {checkVialCondition} from '@/lib/vialCondition';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

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

    const [data, condition] = await Promise.all([
      vial.capture(p),
      checkVialCondition(p).catch(() => null),
    ]);

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
    <>
      <Header step="Vial · Después" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">6 · Evidencia después</div>
          <h1 className="text-2xl font-bold mt-2">Registrar vial después</h1>
          <p className="sub">Vuelve a colocar el vial en la balanza y captura una imagen equivalente.</p>
        </div>

        <CameraCapture onCapture={done} />

        {vial.processing && <p className="text-sm text-slate-500">Leyendo datos del vial y báscula…</p>}
        {mismatch && <p className="text-sm text-red-600 font-semibold">{mismatch}</p>}
        {conditionMsg && <p className="text-sm text-amber-600">{conditionMsg}</p>}

        <div className="card space-y-3">
          <div>
            <label className="font-semibold">Datos del vial</label>
            {vial.codeMsg && <p className="text-sm text-amber-600 mt-1">{vial.codeMsg}</p>}
            {vial.rawCode && (
              <p className="text-xs text-slate-400 mt-1 break-all">
                Contenido crudo del código: <span className="font-mono">{vial.rawCode}</span>
              </p>
            )}
            <div className="mt-2 space-y-2">
              <input
                value={vial.product}
                onChange={(e) => vial.setProduct(e.target.value)}
                placeholder="Producto"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={vial.gtin}
                onChange={(e) => vial.setGtin(e.target.value)}
                placeholder="GTIN"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={vial.lot}
                onChange={(e) => vial.setLot(e.target.value)}
                placeholder="Lote"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={vial.expiry}
                onChange={(e) => vial.setExpiry(e.target.value)}
                placeholder="Vencimiento (AAAA-MM-DD)"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <label className="font-semibold">
            Peso detectado{vial.confidence && ` (confianza: ${vial.confidence})`}
          </label>
          <input
            value={vial.weight}
            onChange={(e) => vial.setWeight(e.target.value)}
            placeholder="Ej. 0.231"
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-xl"
          />
          {vial.weightMsg && <p className="text-sm text-amber-600 mt-2">{vial.weightMsg}</p>}
          {vial.weightReading && (
            <p className="text-xs text-slate-400 mt-2">
              Lectura del display: <span className="font-mono">{vial.weightReading}</span> — verifica que
              coincida con la báscula antes de continuar.
            </p>
          )}
        </div>

        <button disabled={!photo || !vial.weight} className="btn primary disabled:opacity-40" onClick={confirm}>
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
