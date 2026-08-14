'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import {getSession, updateSession} from '@/lib/session';
import type {Session as SessionState} from '@/lib/session';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

type Mode = 'confirm' | 'search' | 'notfound';

// Antes esta pantalla, si ya había un paciente en el localStorage del
// navegador (de un /registro anterior, incluso de días atrás o de otra
// visita), lo usaba sin preguntar — y si no había ninguno, caía
// silenciosamente en "Paciente de prueba". Eso permitía arrastrar por error
// el paciente de una sesión a la siguiente (por ejemplo si el profesional
// vuelve al inicio en vez de darle "Nueva sesión" al cerrar).
//
// Ahora SIEMPRE hay que confirmar explícitamente el paciente en cada
// sesión: si hay uno guardado localmente se pide confirmar que es el
// correcto, y si no, hay que buscarlo por cédula (ya guardado en el
// servidor por /registro) o registrarlo de nuevo — nunca se asume solo.
export default function Session() {
  useRequireProfessional();
  const r = useRouter();
  const [session, setSession] = useState<SessionState>({});
  const [mode, setMode] = useState<Mode>('search');
  const [documentInput, setDocumentInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const s = getSession();
    setSession(s);
    setMode(s.patient ? 'confirm' : 'search');
  }, []);

  function goVerify() {
    r.push('/verificar-paciente');
  }

  // El paciente en pantalla no es el correcto: limpiamos solo los campos de
  // paciente (no el login del profesional) y volvemos a pedir buscarlo.
  function noEsEste() {
    const cleared = updateSession({
      patient: undefined,
      patientDocNumber: undefined,
      patientFirstName: undefined,
      patientMiddleName: undefined,
      patientLastName: undefined,
      patientSecondLastName: undefined,
      patientBirthDate: undefined,
      patientBloodType: undefined,
      patientGender: undefined,
      patientIdPhoto: undefined,
      patientReferencePhoto: undefined,
      patientVerified: null,
      patientLivenessConfidence: undefined,
      patientFaceMatchSimilarity: undefined,
      patientVerificationNotes: undefined,
    });
    setSession(cleared);
    setSearchError('');
    setDocumentInput('');
    setMode('search');
  }

  async function buscar() {
    const doc = documentInput.trim();
    if (!doc) {
      setSearchError('Ingresa el número de documento del paciente.');
      return;
    }
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/patients?documentNumber=${encodeURIComponent(doc)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo buscar el paciente.');
      if (!json.found) {
        setMode('notfound');
        return;
      }
      const fullName = [json.firstName, json.middleName, json.lastName, json.secondLastName]
        .filter(Boolean)
        .join(' ');
      const updated = updateSession({
        patient: fullName || undefined,
        patientDocNumber: json.documentNumber || undefined,
        patientFirstName: json.firstName || undefined,
        patientMiddleName: json.middleName || undefined,
        patientLastName: json.lastName || undefined,
        patientSecondLastName: json.secondLastName || undefined,
        patientBirthDate: json.birthDate || undefined,
        patientBloodType: json.bloodType || undefined,
        patientGender: json.gender === 'M' || json.gender === 'F' ? json.gender : undefined,
        patientIdPhoto: json.idPhotoBase64 || undefined,
        patientReferencePhoto: json.referencePhotoBase64 || undefined,
        // Encontrarlo no verifica identidad: la prueba de vida + Face Match
        // se hace siempre en /verificar-paciente, cara a cara con la cámara.
        patientVerified: null,
        patientLivenessConfidence: undefined,
        patientFaceMatchSimilarity: undefined,
        patientVerificationNotes: undefined,
      });
      setSession(updated);
      setMode('confirm');
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'No se pudo buscar el paciente.');
    } finally {
      setSearching(false);
    }
  }

  // Solo para pruebas/demo (V1): permite seguir el flujo sin un paciente
  // real registrado. Ahora es una acción explícita, no un valor por
  // defecto silencioso.
  function usarPacientePrueba() {
    const updated = updateSession({
      patient: 'Paciente de prueba',
      patientDocNumber: undefined,
      patientFirstName: undefined,
      patientMiddleName: undefined,
      patientLastName: undefined,
      patientSecondLastName: undefined,
      patientBirthDate: undefined,
      patientBloodType: undefined,
      patientGender: undefined,
      patientIdPhoto: undefined,
      patientReferencePhoto: undefined,
      patientVerified: null,
      patientLivenessConfidence: undefined,
      patientFaceMatchSimilarity: undefined,
      patientVerificationNotes: undefined,
    });
    setSession(updated);
    r.push('/verificar-paciente');
  }

  return (
    <>
      <Header step="Nueva administración" />
      <div className="content space-y-5">
        {mode === 'confirm' && (
          <>
            <div className="card">
              <div className="step">2 · Paciente</div>
              <h1 className="text-2xl font-bold mt-2">¿Es este el paciente?</h1>
              <p className="sub">Confirma la identidad antes de continuar — esto evita administrar la dosis a la persona equivocada.</p>
              <div className="status text-green-700 bg-green-50 mt-4">
                <span className="dot" />
                {session.patient}
              </div>
              {session.patientDocNumber && (
                <p className="text-sm text-slate-500 mt-2">Documento: {session.patientDocNumber}</p>
              )}
            </div>
            <button className="btn primary" onClick={goVerify}>
              Sí, es este paciente — continuar
            </button>
            <button className="btn secondary" onClick={noEsEste}>
              No es este paciente / buscar otro
            </button>
          </>
        )}

        {(mode === 'search' || mode === 'notfound') && (
          <>
            <div className="card space-y-3">
              <div className="step">2 · Paciente</div>
              <h1 className="text-2xl font-bold mt-2">Identificar paciente</h1>
              <p className="sub">Busca al paciente por su número de documento (debe estar registrado previamente por cédula).</p>
              <input
                value={documentInput}
                onChange={(e) => setDocumentInput(e.target.value)}
                placeholder="Número de documento"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              {searchError && <p className="text-sm text-red-700 bg-red-50 rounded-md p-2">{searchError}</p>}
              {mode === 'notfound' && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-md p-2">
                  No se encontró un paciente con ese documento. Regístralo primero escaneando su cédula.
                </p>
              )}
            </div>
            <button className="btn primary disabled:opacity-40" onClick={buscar} disabled={searching}>
              {searching ? 'Buscando…' : 'Buscar paciente'}
            </button>
            <a href="/registro" className="btn secondary block text-center">
              Registrar nuevo paciente (escanear cédula)
            </a>
            <button className="btn secondary" onClick={usarPacientePrueba}>
              Usar paciente de prueba (solo demo/V1)
            </button>
          </>
        )}
      </div>
    </>
  );
}
