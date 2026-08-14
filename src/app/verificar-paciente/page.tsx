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

  // Preferimos la foto EN VIVO capturada en /registro (más confiable,
  // ver session.ts) y caemos a la foto de la cédula si no existe (pacientes
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
      updateSession({
        patientVerified: verified,
        patientLivenessConfidence: result.confidence,
        patientFaceMatchSimilarity: json.similarity ?? 0,
        patientVerificationNotes: verified
          ? 'Prueba de vida y coincidencia facial confirmadas.'
          : `El rostro capturado no coincide con la foto de referencia (similitud ${Math.round(json.similarity ?? 0)}%).`,
      });
      setOk(verified);
      setNotes(
        verified
          ? `Coincide con la foto de referencia (similitud ${Math.round(json.similarity ?? 0)}%).`
          : `No coincide con la foto de referencia (similitud ${Math.round(json.similarity ?? 0)}%).`
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
    return (
      <>
        <Header step="Verificación del paciente" />
        <div className="content space-y-5">
          <div className="card">
            <div className="step">2b · Paciente</div>
            <h1 className="text-2xl font-bold mt-2">Verificando identidad</h1>
            <p className="sub">Mira a la cámara y sigue las instrucciones en pantalla.</p>
          </div>
          <LivenessCheck onComplete={onComplete} onCancel={() => setStarted(false)} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header step="Verificación del paciente" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">2b · Paciente</div>
          <h1 className="text-2xl font-bold mt-2">Confirmar identidad del paciente</h1>
          <p className="sub">
            {hasIdPhoto
              ? 'Vamos a confirmar que la persona presente es real (prueba de vida) y que coincide con su foto de referencia.'
              : 'Este paciente no tiene una foto de referencia registrada, así que solo confirmaremos prueba de vida.'}
          </p>

          {error && <p className="text-sm text-red-700 bg-red-50 rounded-md p-2 mt-3">{error}</p>}

          {done && (
            <p
              className={`text-sm rounded-md p-2 mt-3 ${
                ok ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
              }`}
            >
              {notes}
            </p>
          )}
        </div>

        {!done && (
          <button className="btn primary disabled:opacity-40" onClick={() => setStarted(true)} disabled={busy}>
            Iniciar verificación
          </button>
        )}
        {done && (
          <>
            <button className="btn primary" onClick={continuar}>
              Ver medicamentos pendientes
            </button>
            {!ok && (
              <button className="btn secondary" onClick={() => setDone(false)}>
                Intentar de nuevo
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
