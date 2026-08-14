'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {updateSession} from '@/lib/session';
import {analyzeVialWeight} from '@/lib/analyzeVial';

export default function After() {
  const r = useRouter();
  const [photo, setPhoto] = useState('');
  const [weight, setWeight] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState('');
  const [weightReading, setWeightReading] = useState('');
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja' | ''>('');

  async function done(p: string) {
    setPhoto(p);
    updateSession({afterPhoto: p});
    setAnalyzing(true);
    setAnalyzeMsg('');
    setWeightReading('');
    setConfidence('');
    try {
      const result = await analyzeVialWeight(p);
      if (result.weight != null) setWeight(String(result.weight));
      setConfidence(result.confidence);
      if (result.digitsSeen != null) {
        setWeightReading(`${result.digitsSeen}${result.unit ? ' ' + result.unit : ''}`);
      }
      if (result.confidence !== 'alta') {
        setAnalyzeMsg(result.notes || 'Verifica el peso detectado antes de continuar.');
      }
    } catch {
      setAnalyzeMsg('No se pudo leer la báscula automáticamente. Ingresa el peso manualmente.');
    } finally {
      setAnalyzing(false);
    }
  }

  function confirm() {
    const n = Number(weight.replace(',', '.'));
    updateSession({afterWeight: Number.isFinite(n) ? n : undefined});
    r.push('/complete');
  }

  return (
    <>
      <Header step="Vial · Después" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">5 · Evidencia después</div>
          <h1 className="text-2xl font-bold mt-2">Registrar vial después</h1>
          <p className="sub">Vuelve a colocar el vial en la balanza y captura una imagen equivalente.</p>
        </div>
        <CameraCapture onCapture={done} />
        {analyzing && <p className="text-sm text-slate-500">Analizando imagen…</p>}
        {analyzeMsg && <p className="text-sm text-amber-600">{analyzeMsg}</p>}
        <div className="card">
          <label className="font-semibold">
            Peso detectado{confidence && ` (confianza: ${confidence})`}
          </label>
          <input
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Ej. 0.231"
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-xl"
          />
          {weightReading && (
            <p className="text-xs text-slate-400 mt-2">
              Lectura del display: <span className="font-mono">{weightReading}</span> — verifica que coincida
              con la báscula antes de continuar.
            </p>
          )}
        </div>
        <button disabled={!photo || !weight} className="btn primary disabled:opacity-40" onClick={confirm}>
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
