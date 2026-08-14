'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import LivenessCheck, {type LivenessResult} from '@/components/LivenessCheck';
import {getSession, updateSession} from '@/lib/session';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

export default function VerificarPaciente() {
  useRequireProfessional();
  const r = useRouter();
  const [session] = useState(() => getSession());
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [ok, setOk] = useState(false);
  const [notes, setNotes] = useState('');
  const [similarity, setSimilarity] = useState<number | null>(null);

  // Preferimos la foto EN VIVO capturada en /registro (más confiable, ver
  // session.ts) y caemos a la foto de la cédula si no existe (pacientes
  // registrados antes de este cambio, o que omitieron ese paso).
  const referenceImage = session.patientReferencePhoto || session.patientIdPhoto;
  const hasIdPhoto = !!referenceImage;

  async function onComplete(result: LivenessResult) {
    setStarted(false);
    setBusy(true);
    setError('');
    try {
      if (!result.isLive || !result.referenceImageBase64) {
        updateSession({
          patientVerified: false,
          patientLivenessConfidence: result.confidence,
          patientVerificationNotes: 'No se confirmó prueba de vida (posible foto, video o pantalla frente a la cámara).',
        });
        setOk(false);
        setNotes('No se confirmó que hubiera una persona real frente a la cámara.');
        setDone(true);
        return;
      }

      if (!referenceImage) {
        // No hay ninguna foto de referencia para comparar (paciente de
        // prueba / no registrado todavía): solo validamos prueba de vida.
        updateSession({
          patientVerified: true,
          patientLivenessConfidence: result.confidence,
          patientVerificationNotes: 'Prueba de vida confirmada. No había foto de referencia para comparar (paciente sin registrar).',
        });
        setOk(true);
        setNotes('Prueba de vida confirmada. No se comparó contra ninguna foto porque el paciente no está registrado.');
        setDone(true);
        return;
      }

      const res = await fetch('/api/liveness/compare-faces', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          sourceImageBase64: referenceImage,
          targetImageBase64: `data:image/jpeg;base64,${result.referenceImageBase64}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo comparar el rostro con la cédula.');

      const verified = !!json.matched;
      const sim = Math.round(json.similarity ?? 0);
      updateSession({
        patientVerified: verified,
        patientLivenessConfidence: result.confidence,
        patientFaceMatchSimilarity: json.similarity ?? 0,
        patientVerificationNotes: verified
          ? 'Prueba de vida y coincidencia facial confirmadas.'
          : `El rostro capturado no coincide con la foto de referencia (similitud ${sim}%).`,
      });
      setOk(verified);
      setSimilarity(sim);
      setNotes(
        verified
          ? `Coincide con la foto de referencia (similitud ${sim}%).`
          : `No coincide con la foto de referencia (similitud ${sim}%).`
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar la identidad del paciente.');
    } finally {
      setBusy(false);
    }
  }

  function continuar() {
    r.push('/atenciones');
  }

  if (started) {
    // Sin Header aquí a propósito: el componente de cámara de AWS necesita
    // todo el alto disponible, y con el header fijo arriba parte de su
    // contenido (el aviso de fotosensibilidad, el óvalo) quedaba tapado o
    // forzaba scroll. Amplify ya trae su propio botón de cancelar.
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-xl px-4 py-4">
          <LivenessCheck onComplete={onComplete} onCancel={() => setStarted(false)} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={1} stepSuffix="b" stepLabel="Verificación" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-4">
          <h1 className="text-2xl font-bold text-slate-900">Confirmar identidad del paciente</h1>
        </div>

        {!done && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-700">
              ◉
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-slate-900">Prueba de vida + comparación facial</h2>
            <p className="mt-2 text-center text-sm leading-6 text-slate-500">
              {hasIdPhoto
                ? 'Vamos a confirmar que la persona presente es real (prueba de vida) y que coincide con su foto de referencia.'
                : 'Este paciente no tiene una foto de referencia registrada, así que solo confirmaremos prueba de vida.'}
            </p>

            {!hasIdPhoto && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Solo se validará prueba de vida — no hay foto de referencia con qué comparar.
              </div>
            )}

            {error && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{error}</p>}

            <button
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 font-semibold text-white shadow-sm disabled:opacity-70 active:scale-[0.98]"
              onClick={() => setStarted(true)}
              disabled={busy}
            >
              {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Iniciar verificación
            </button>
          </div>
        )}

        {done && ok && (
          <>
            <div className="flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
              <span className="font-bold text-green-700">✓</span>
              <div>
                <p className="font-semibold text-green-950">Identidad confirmada</p>
                <p className="mt-1 text-sm text-green-800">
                  {similarity != null ? `Similitud: ${similarity}%` : notes}
                </p>
              </div>
            </div>
            <button
              className="mt-6 min-h-12 w-full rounded-xl bg-blue-700 px-5 font-semibold text-white shadow-sm active:scale-[0.98]"
              onClick={continuar}
            >
              Ver medicamentos pendientes
            </button>
          </>
        )}

        {done && !ok && (
          <>
            <div className="flex gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
                !
              </div>
              <div>
                <p className="font-bold text-red-950">No se pudo confirmar</p>
                <p className="mt-1 text-sm text-red-900">{notes}</p>
              </div>
            </div>
            <button
              className="mt-6 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
              onClick={() => setDone(false)}
            >
              Intentar de nuevo
            </button>
          </>
        )}
      </main>
    </div>
  );
}
