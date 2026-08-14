'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import LivenessCheck, {type LivenessResult} from '@/components/LivenessCheck';
import {updateSession} from '@/lib/session';
import {scanPdf417} from '@/lib/scanIdBarcode';
import {parseCedulaPdf417} from '@/lib/cedulaPdf417';
import {readCedula} from '@/lib/readCedula';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

type Step = 'frente' | 'reverso' | 'form' | 'foto-viva';

function Field({
  value,
  onChange,
  placeholder,
  inputMode,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: 'numeric' | 'text';
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      maxLength={maxLength}
      className="min-h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
    />
  );
}

export default function Registro() {
  useRequireProfessional();
  const r = useRouter();
  const [step, setStep] = useState<Step>('frente');
  const [frontPhoto, setFrontPhoto] = useState('');
  const [backPhoto, setBackPhoto] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sourceMsg, setSourceMsg] = useState('');
  const [rawBarcode, setRawBarcode] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [secondLastName, setSecondLastName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [gender, setGender] = useState('');

  // Foto EN VIVO del paciente (Face Liveness), capturada como referencia
  // para el Face Match en /verificar-paciente — la foto de la cédula puede
  // tener varios años y dejar de parecerse a la persona.
  const [livenessStarted, setLivenessStarted] = useState(false);
  const [livenessError, setLivenessError] = useState('');

  async function onFront(p: string) {
    setFrontPhoto(p);
    setStep('reverso');
  }

  async function onBack(p: string) {
    setBackPhoto(p);
    setStep('form');
    setProcessing(true);
    setSourceMsg('');
    setRawBarcode('');

    // 1. Cédula amarilla: intenta leer el PDF417 del reverso. Los datos
    //    solo se usan si pasan una validación de forma (ver
    //    cedulaPdf417.ts) — si algo no calza, se descarta y se cae a OCR.
    try {
      const barcode = await scanPdf417(p);
      if (barcode) {
        setRawBarcode(barcode.text || barcode.bytesLatin1);
        const data = parseCedulaPdf417(barcode.bytesLatin1);
        if (data) {
          setFirstName(data.firstName);
          setMiddleName(data.middleName || '');
          setLastName(data.lastName);
          setSecondLastName(data.secondLastName || '');
          setDocumentNumber(data.documentNumber);
          setBirthDate(data.birthDate);
          setBloodType(data.bloodType || '');
          setGender(data.gender);
          setSourceMsg(
            'Datos leídos del código de barras del reverso. Este formato no está documentado oficialmente — verifica cuidadosamente antes de guardar.'
          );
          setProcessing(false);
          return;
        }
      }
    } catch {
      // sigue a OCR
    }

    // 2. Cédula digital (azul) o si el PDF417 no se pudo leer/validar:
    //    OCR del texto impreso en frente y reverso.
    try {
      const label = await readCedula(frontPhoto, p);
      setFirstName(label.firstName || '');
      setMiddleName(label.middleName || '');
      setLastName(label.lastName || '');
      setSecondLastName(label.secondLastName || '');
      setDocumentNumber(label.documentNumber || '');
      setBirthDate(label.birthDate || '');
      setBloodType(label.bloodType || '');
      setGender(label.gender || '');
      setSourceMsg(
        `No se pudo leer un código de barras válido; datos leídos por IA (confianza: ${label.confidence}). ${
          label.notes || 'Verifica que sean correctos antes de guardar.'
        }`
      );
    } catch {
      setSourceMsg('No se pudo leer el código ni el texto de la cédula automáticamente. Completa los datos manualmente.');
    } finally {
      setProcessing(false);
    }
  }

  async function onLivenessComplete(result: LivenessResult) {
    setLivenessStarted(false);
    setLivenessError('');
    if (!result.isLive || !result.referenceImageBase64) {
      setLivenessError('No se confirmó una prueba de vida real. Puedes intentarlo de nuevo u omitir este paso.');
      return;
    }
    await guardar(`data:image/jpeg;base64,${result.referenceImageBase64}`);
  }

  async function guardar(referencePhoto?: string) {
    const fullName = [firstName, middleName, lastName, secondLastName].filter(Boolean).join(' ');
    updateSession({
      patient: fullName || undefined,
      patientFirstName: firstName || undefined,
      patientMiddleName: middleName || undefined,
      patientLastName: lastName || undefined,
      patientSecondLastName: secondLastName || undefined,
      patientDocNumber: documentNumber || undefined,
      patientBirthDate: birthDate || undefined,
      patientBloodType: bloodType || undefined,
      patientGender: gender === 'M' || gender === 'F' ? gender : undefined,
      // Foto del frente de la cédula (trae la foto impresa de la persona),
      // se muestra como referencia visual y sirve de respaldo si no hay
      // foto en vivo.
      patientIdPhoto: frontPhoto || undefined,
      // Foto EN VIVO capturada justo arriba (Face Liveness) — preferida
      // para el Face Match en /verificar-paciente, ver session.ts.
      patientReferencePhoto: referencePhoto || undefined,
      // Un nuevo registro invalida cualquier verificación biométrica previa.
      patientVerified: null,
      patientLivenessConfidence: undefined,
      patientFaceMatchSimilarity: undefined,
      patientVerificationNotes: undefined,
    });

    // Guarda el paciente también en el servidor (Supabase), no solo en este
    // navegador — así se puede buscar por cédula desde /session en otra
    // sesión o dispositivo, en vez de depender de que siga en este mismo
    // localStorage.
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          documentNumber,
          firstName,
          middleName,
          lastName,
          secondLastName,
          birthDate,
          bloodType,
          gender,
          idPhotoBase64: frontPhoto,
          referencePhotoBase64: referencePhoto,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo guardar el paciente en el servidor.');
    } catch (e) {
      // No perdemos los datos: ya quedaron en este dispositivo (localStorage)
      // y se puede seguir usando la sesión con normalidad. Nos quedamos en
      // esta pantalla para avisar, en vez de navegar y que el aviso se
      // pierda, y dejamos que el usuario decida reintentar o continuar.
      setSaveError(
        e instanceof Error
          ? `El paciente se guardó en este dispositivo, pero no se pudo respaldar en el servidor: ${e.message}`
          : 'El paciente se guardó en este dispositivo, pero no se pudo respaldar en el servidor.'
      );
      setSaving(false);
      return;
    }
    setSaving(false);
    r.push('/');
  }

  // Durante la captura en vivo (foto-viva + livenessStarted) escondemos el
  // Header y la intro: el componente de cámara de AWS necesita todo el alto
  // disponible, y con el header fijo arriba parte de su contenido quedaba
  // tapado o forzaba scroll. Amplify ya trae su propio botón de cancelar.
  const capturandoEnVivo = step === 'foto-viva' && livenessStarted;

  return (
    <div className="min-h-screen bg-slate-50">
      {!capturandoEnVivo && <Header stepIndex={1} stepLabel="Registro" />}
      <main className="mx-auto max-w-xl px-4 py-4">
        {!capturandoEnVivo && (
          <div className="py-4">
            <h1 className="text-2xl font-bold text-slate-900">Escanear cédula</h1>
            <p className="mt-2 text-sm text-slate-500">
              Funciona con la cédula amarilla (laminada) y la cédula digital azul. Primero el frente, luego el
              reverso.
            </p>
          </div>
        )}

        {step === 'frente' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-3 block text-sm font-semibold text-slate-700">1 · Frente de la cédula</label>
            <CameraCapture onCapture={onFront} guideText="Frente de la cédula" aspect="retrato" />
          </div>
        )}

        {step === 'reverso' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-sm font-semibold text-slate-700">2 · Reverso de la cédula</label>
            <p className="mb-3 text-xs text-slate-500">
              En la cédula amarilla, el reverso trae el código de barras — inclúyelo bien enfocado en la foto.
            </p>
            <CameraCapture onCapture={onBack} guideText="Reverso de la cédula, con el código de barras visible" aspect="retrato" />
          </div>
        )}

        {step === 'form' && (
          <div className="space-y-4">
            {processing && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />
                Leyendo datos de la cédula…
              </div>
            )}
            {sourceMsg && <p className="rounded-xl bg-amber-50 p-2 text-sm text-amber-700">{sourceMsg}</p>}
            {rawBarcode && (
              <p className="break-all text-xs text-slate-400">
                Contenido crudo del código de barras: <span className="font-mono">{rawBarcode}</span>
              </p>
            )}

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Datos de la persona</label>
              <Field value={firstName} onChange={setFirstName} placeholder="Primer nombre" />
              <Field value={middleName} onChange={setMiddleName} placeholder="Segundo nombre" />
              <Field value={lastName} onChange={setLastName} placeholder="Primer apellido" />
              <Field value={secondLastName} onChange={setSecondLastName} placeholder="Segundo apellido" />
              <Field value={documentNumber} onChange={setDocumentNumber} placeholder="Número de cédula" inputMode="numeric" />
              <Field value={birthDate} onChange={setBirthDate} placeholder="Fecha de nacimiento (AAAA-MM-DD)" />
              <Field value={bloodType} onChange={setBloodType} placeholder="Tipo de sangre (Ej. O+)" />
              <Field
                value={gender}
                onChange={(v) => setGender(v.toUpperCase())}
                placeholder="Sexo (M/F)"
                maxLength={1}
              />
            </div>

            <button
              disabled={!firstName || !lastName}
              className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm disabled:opacity-40 active:scale-[0.98]"
              onClick={() => setStep('foto-viva')}
            >
              Continuar
            </button>
          </div>
        )}

        {step === 'foto-viva' && !livenessStarted && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700">
                ◉
              </div>
              <h2 className="mt-4 text-center text-lg font-bold text-slate-900">Foto de referencia (en vivo)</h2>
              <p className="mt-2 text-center text-sm leading-6 text-slate-500">
                La foto de la cédula puede ser de hace varios años. Tomamos una foto en vivo del paciente ahora
                mismo (misma prueba de vida que usa el profesional al ingresar) para que las verificaciones
                futuras comparen contra una imagen reciente y confiable.
              </p>

              {livenessError && (
                <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{livenessError}</p>
              )}
              {saveError && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{saveError}</p>}

              <div className="mt-6 space-y-3">
                <button
                  className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm disabled:opacity-40 active:scale-[0.98]"
                  onClick={() => setLivenessStarted(true)}
                  disabled={saving}
                >
                  Iniciar captura
                </button>
                <button
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 disabled:opacity-40 active:scale-[0.98]"
                  onClick={() => guardar()}
                  disabled={saving}
                >
                  {saving && (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />
                  )}
                  {saving ? 'Guardando…' : 'Omitir (usar solo foto de la cédula)'}
                </button>
                {saveError && (
                  <button
                    className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
                    onClick={() => r.push('/')}
                  >
                    Continuar de todas formas (ya quedó guardado en este dispositivo)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'foto-viva' && livenessStarted && (
          <div className="space-y-4">
            <div className="py-2">
              <p className="text-sm text-slate-500">Mira a la cámara y sigue las instrucciones en pantalla.</p>
            </div>
            <LivenessCheck onComplete={onLivenessComplete} onCancel={() => setLivenessStarted(false)} />
          </div>
        )}
      </main>
    </div>
  );
}
