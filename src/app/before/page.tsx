'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {updateSession} from '@/lib/session';
import {analyzeVialWeight} from '@/lib/analyzeVial';
import {scanDataMatrix} from '@/lib/scanDataMatrix';
import {parseGS1} from '@/lib/gs1';
import {readVialLabel} from '@/lib/readLabel';

export default function Before() {
  const r = useRouter();
  const [photo, setPhoto] = useState('');
  const [weight, setWeight] = useState('');
  const [product, setProduct] = useState('');
  const [gtin, setGtin] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [processing, setProcessing] = useState(false);
  const [weightMsg, setWeightMsg] = useState('');
  const [weightReading, setWeightReading] = useState('');
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja' | ''>('');
  const [codeMsg, setCodeMsg] = useState('');
  const [rawCode, setRawCode] = useState('');

  // Cadena de respaldo para los datos del vial (producto/GTIN/lote/vencimiento):
  //   1. DataMatrix leído como GS1 (HRI o "plano" — ver src/lib/gs1.ts).
  //   2. Si el DataMatrix no se pudo interpretar como GS1 en ningún
  //      formato (o no se detectó ningún código), leer la etiqueta
  //      impresa por OCR/visión como último recurso.
  async function resolveVialData(photoDataUrl: string) {
    const code = await scanDataMatrix(photoDataUrl);

    if (code) {
      const data = parseGS1(code);
      if (data.gtin || data.lot) {
        if (data.gtin) setGtin(data.gtin);
        if (data.lot) setLot(data.lot);
        if (data.expiry) setExpiry(data.expiry);
        updateSession({gtin: data.gtin, lot: data.lot, expiry: data.expiry, serial: data.serial});
        setCodeMsg('');
        return;
      }
      // Se detectó un código pero no se pudo interpretar como GS1 (ni
      // HRI ni plano). Lo mostramos para referencia y caemos a OCR.
      setRawCode(code);
      setCodeMsg('El código detectado no tiene formato GS1 reconocido. Leyendo la etiqueta con IA…');
    } else {
      setCodeMsg('No se detectó código DataMatrix. Leyendo la etiqueta con IA…');
    }

    try {
      const label = await readVialLabel(photoDataUrl);
      if (label.product) setProduct(label.product);
      if (label.lot) setLot(label.lot);
      if (label.expiry) setExpiry(label.expiry);
      updateSession({product: label.product || undefined, lot: label.lot || undefined, expiry: label.expiry || undefined});
      if (label.confidence === 'alta' && (label.product || label.lot)) {
        setCodeMsg('No se detectó código; datos leídos por IA desde la etiqueta. Verifica que sean correctos.');
      } else {
        setCodeMsg(
          label.notes ||
            'No se pudo leer el código ni la etiqueta con confianza. Completa los datos manualmente.'
        );
      }
    } catch {
      setCodeMsg(
        (code ? 'El código no es GS1 reconocible y ' : '') +
          'no se pudo leer la etiqueta automáticamente. Completa los datos manualmente.'
      );
    }
  }

  async function done(p: string) {
    setPhoto(p);
    updateSession({beforePhoto: p});
    setProcessing(true);
    setWeightMsg('');
    setWeightReading('');
    setCodeMsg('');
    setRawCode('');
    setConfidence('');

    const [, weightResult] = await Promise.allSettled([
      resolveVialData(p),
      analyzeVialWeight(p),
    ]);

    if (weightResult.status === 'fulfilled') {
      const result = weightResult.value;
      if (result.weight != null) setWeight(String(result.weight));
      setConfidence(result.confidence);
      if (result.digitsSeen != null) {
        setWeightReading(`${result.digitsSeen}${result.unit ? ' ' + result.unit : ''}`);
      }
      if (result.confidence !== 'alta') {
        setWeightMsg(result.notes || 'Verifica el peso detectado antes de continuar.');
      }
    } else {
      setWeightMsg('No se pudo leer la báscula automáticamente. Ingresa el peso manualmente.');
    }

    setProcessing(false);
  }

  function confirm() {
    const n = Number(weight.replace(',', '.'));
    updateSession({
      beforeWeight: Number.isFinite(n) ? n : undefined,
      product: product || undefined,
      gtin: gtin || undefined,
      lot: lot || undefined,
      expiry: expiry || undefined,
    });
    r.push('/after');
  }

  return (
    <>
      <Header step="Vial · Antes" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">4 · Evidencia antes</div>
          <h1 className="text-2xl font-bold mt-2">Fotografía + peso</h1>
          <p className="sub">
            Coloca el vial sobre una balanza convencional. La cámara debe incluir el vial (con su código
            DataMatrix visible) y el display de la báscula.
          </p>
        </div>

        <CameraCapture onCapture={done} />

        {processing && <p className="text-sm text-slate-500">Leyendo datos del vial y báscula…</p>}

        <div className="card space-y-3">
          <div>
            <label className="font-semibold">Datos del vial</label>
            {codeMsg && <p className="text-sm text-amber-600 mt-1">{codeMsg}</p>}
            {rawCode && (
              <p className="text-xs text-slate-400 mt-1 break-all">
                Contenido crudo del código: <span className="font-mono">{rawCode}</span>
              </p>
            )}
            <div className="mt-2 space-y-2">
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Producto"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                placeholder="GTIN"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Lote"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                placeholder="Vencimiento (AAAA-MM-DD)"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <label className="font-semibold">
            Peso detectado{confidence && ` (confianza: ${confidence})`}
          </label>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Ej. 5.182"
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-xl"
          />
          {weightMsg && <p className="text-sm text-amber-600 mt-2">{weightMsg}</p>}
          {weightReading && (
            <p className="text-xs text-slate-400 mt-2">
              Lectura del display: <span className="font-mono">{weightReading}</span> — verifica que coincida
              con la báscula antes de continuar.
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            Detectado automáticamente a partir de la foto. Puedes corregirlo manualmente si es necesario.
          </p>
        </div>

        <button disabled={!photo || !weight} className="btn primary disabled:opacity-40" onClick={confirm}>
          Confirmar ANTES
        </button>
      </div>
    </>
  );
}
