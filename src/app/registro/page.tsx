'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import CameraCapture from '@/components/CameraCapture';
import {updateSession} from '@/lib/session';
import {scanPdf417} from '@/lib/scanIdBarcode';
import {parseCedulaPdf417} from '@/lib/cedulaPdf417';
import {readCedula} from '@/lib/readCedula';

type Step = 'frente' | 'reverso' | 'form';

export default function Registro() {
  const r = useRouter();
  const [step, setStep] = useState<Step>('frente');
  const [frontPhoto, setFrontPhoto] = useState('');
  const [backPhoto, setBackPhoto] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sourceMsg, setSourceMsg] = useState('');
  const [rawBarcode, setRawBarcode] = useState('');

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [secondLastName, setSecondLastName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [gender, setGender] = useState('');

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

  function guardar() {
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
    });
    r.push('/');
  }

  return (
    <>
      <Header step="Registro por cédula" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">Registro</div>
          <h1 className="text-2xl font-bold mt-2">Escanear cédula</h1>
          <p className="sub">
            Funciona con la cédula amarilla (laminada) y la cédula digital azul. Primero el frente, luego el
            reverso.
          </p>
        </div>

        {step === 'frente' && (
          <div className="card space-y-3">
            <label className="font-semibold">1 · Frente de la cédula</label>
            <CameraCapture onCapture={onFront} />
          </div>
        )}

        {step === 'reverso' && (
          <div className="card space-y-3">
            <label className="font-semibold">2 · Reverso de la cédula</label>
            <p className="text-xs text-slate-500">
              En la cédula amarilla, el reverso trae el código de barras — inclúyelo bien enfocado en la foto.
            </p>
            <CameraCapture onCapture={onBack} />
          </div>
        )}

        {step === 'form' && (
          <>
            {processing && <p className="text-sm text-slate-500">Leyendo datos de la cédula…</p>}
            {sourceMsg && <p className="text-sm text-amber-600">{sourceMsg}</p>}
            {rawBarcode && (
              <p className="text-xs text-slate-400 break-all">
                Contenido crudo del código de barras: <span className="font-mono">{rawBarcode}</span>
              </p>
            )}

            <div className="card space-y-2">
              <label className="font-semibold">Datos de la persona</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Primer nombre"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Segundo nombre"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Primer apellido"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={secondLastName}
                onChange={(e) => setSecondLastName(e.target.value)}
                placeholder="Segundo apellido"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Número de cédula"
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="Fecha de nacimiento (AAAA-MM-DD)"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                placeholder="Tipo de sangre (Ej. O+)"
                className="w-full rounded-xl border border-slate-200 p-3"
              />
              <input
                value={gender}
                onChange={(e) => setGender(e.target.value.toUpperCase())}
                placeholder="Sexo (M/F)"
                maxLength={1}
                className="w-full rounded-xl border border-slate-200 p-3"
              />
            </div>

            <button
              disabled={!firstName || !lastName}
              className="btn primary disabled:opacity-40"
              onClick={guardar}
            >
              Guardar registro
            </button>
          </>
        )}
      </div>
    </>
  );
}
