'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Header from '@/components/Header';
import {updateSession} from '@/lib/session';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

export default function NFC() {
  useRequireProfessional();
  const [msg, setMsg] = useState('Acerca el teléfono al tag NFC del empaque.');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [validated, setValidated] = useState(false);
  const r = useRouter();

  async function scan() {
    const ok = 'NDEFReader' in window;
    setSupported(ok);
    if (!ok) {
      setMsg('Web NFC no está disponible en este navegador. Para V1 usamos Android/Chrome o un fallback QR.');
      return;
    }
    try {
      const Reader = (window as any).NDEFReader;
      const ndef = new Reader();
      await ndef.scan();
      ndef.onreading = () => {
        updateSession({tagId: 'DEMO-8A43F921', beforeProduct: 'Medicamento de prueba', beforeLot: 'ABC123'});
        setMsg('Tag leído y asociado a la sesión.');
        setValidated(true);
        setTimeout(() => r.push('/before'), 500);
      };
      setMsg('NFC activo. Acerca el teléfono al tag.');
    } catch {
      setMsg('No se pudo iniciar NFC. Comprueba permisos y HTTPS.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={4} stepLabel="Empaque" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-5">
          <p className="text-sm font-semibold text-teal-700">Paso 4 de 7 · Empaque</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Validar empaque</h1>
          <p className="mt-2 text-sm text-slate-500">
            El teléfono lee el identificador NFC. La validación contra producto, lote y estado se hará en backend.
          </p>
        </div>

        {validated ? (
          <div className="flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4">
            <span className="font-bold text-green-700">✓</span>
            <div>
              <p className="font-semibold text-green-950">Empaque validado</p>
              <p className="mt-1 text-sm text-green-800">Tag NFC: DEMO-8A43F921</p>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-teal-50 text-6xl text-teal-700">
              ◉
            </div>
            <p className="mt-6 text-lg font-bold text-slate-900">Listo para escanear</p>
            <p className="mt-2 text-sm text-slate-500">{msg}</p>
            <button
              className="mt-7 min-h-12 w-full rounded-xl bg-teal-700 px-5 font-semibold text-white shadow-sm active:scale-[0.98]"
              onClick={scan}
            >
              Escanear NFC
            </button>
          </div>
        )}

        {supported === false && (
          <>
            <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <span className="font-bold text-amber-700">!</span>
              <div>
                <p className="font-semibold text-amber-950">NFC no disponible en este navegador</p>
                <p className="mt-1 text-sm text-amber-900">
                  Puedes continuar con el flujo de demostración o con lectura por QR.
                </p>
              </div>
            </div>
            <button
              className="mt-4 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
              onClick={() => r.push('/before')}
            >
              Continuar con demo / QR
            </button>
          </>
        )}
      </main>
    </div>
  );
}
