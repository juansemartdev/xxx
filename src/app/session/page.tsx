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
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={1} stepLabel="Paciente" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        {mode === 'confirm' && (
          <>
            <div className="py-4">
              <h1 className="text-2xl font-bold text-slate-900">Confirma el paciente</h1>
              <p className="mt-2 text-sm text-slate-500">
                Verifica que la persona frente a ti corresponda al registro — esto evita administrar la dosis a la
                persona equivocada.
              </p>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Paciente identificado</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{session.patient}</h2>
              {session.patientDocNumber && (
                <p className="mt-1 text-sm text-slate-600">CC {session.patientDocNumber}</p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              <button
                className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm active:scale-[0.98]"
                onClick={goVerify}
              >
                Sí, es este paciente — continuar
              </button>
              <button
                className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
                onClick={noEsEste}
              >
                No es este paciente / buscar otro
              </button>
            </div>
          </>
        )}

        {(mode === 'search' || mode === 'notfound') && (
          <>
            <div className="py-4">
              <h1 className="text-2xl font-bold text-slate-900">Identificar paciente</h1>
              <p className="mt-2 text-sm text-slate-500">
                Busca por número de documento (debe estar registrado previamente por cédula).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Número de documento</span>
                <input
                  value={documentInput}
                  onChange={(e) => setDocumentInput(e.target.value)}
                  placeholder="Ej. 1030123456"
                  inputMode="numeric"
                  className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-lg outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                />
              </label>

              {searchError && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{searchError}</p>}
              {mode === 'notfound' && (
                <p className="mt-3 rounded-xl bg-amber-50 p-2 text-sm text-amber-700">
                  No se encontró un paciente con ese documento. Regístralo primero escaneando su cédula.
                </p>
              )}

              <button
                className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm disabled:opacity-70 active:scale-[0.98]"
                onClick={buscar}
                disabled={searching}
              >
                {searching && (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}
                {searching ? 'Buscando…' : 'Buscar paciente'}
              </button>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">o</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <a
                href="/registro"
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-center font-semibold text-slate-700 active:scale-[0.98]"
              >
                Registrar nuevo paciente · escanear cédula
              </a>
              <button className="mt-3 w-full py-3 text-sm text-slate-500" onClick={usarPacientePrueba}>
                Usar paciente de prueba (solo demo/V1)
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
