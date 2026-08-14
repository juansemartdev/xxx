'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {getSession, updateSession} from '@/lib/session';
import {useVialCapture} from '@/lib/useVialCapture';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

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
    <>
      <Header step="Vial · Antes" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">5 · Evidencia antes</div>
          <h1 className="text-2xl font-bold mt-2">Fotografía + peso</h1>
          <p className="sub">
            Coloca el vial sobre una balanza convencional. La cámara debe incluir el vial (con su código
            DataMatrix visible) y el display de la báscula.
          </p>
        </div>

        {atencion && (
          <div className="card">
            <label className="font-semibold">Prescrito (atención seleccionada)</label>
            <p className="text-sm text-slate-500 mt-1">
              {atencion.product}
              {atencion.lot && <> · Lote: {atencion.lot}</>}
              {atencion.expiry && <> · Vence: {atencion.expiry}</>}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Solo informativo — compara contra lo que leas del vial físico abajo.
            </p>
          </div>
        )}

        <CameraCapture onCapture={done} />

        {vial.processing && <p className="text-sm text-slate-500">Leyendo datos del vial y báscula…</p>}

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
            placeholder="Ej. 5.182"
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
          <p className="text-xs text-slate-500 mt-2">
            Detectado automáticamente a partir de la foto. Puedes corregirlo manualmente si es necesario.
          </p>
        </div>

        <button disabled={!photo || !vial.weight} className="btn primary disabled:opacity-40" onClick={confirm}>
          Confirmar ANTES
        </button>
      </div>
    </>
  );
}
