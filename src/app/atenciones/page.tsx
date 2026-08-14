'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import {getSession, updateSession} from '@/lib/session';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

type Medicamento = {
  id: number;
  product: string;
  gtin: string | null;
  lot: string | null;
  expiry: string | null;
  notes: string | null;
  status: string;
};

type Atencion = {
  id: number;
  documentNumber: string;
  externalReference: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  medications: Medicamento[];
};

// Lista los medicamentos pendientes del paciente ya identificado/verificado.
// Una atención (creada por un sistema externo vía POST /api/atenciones)
// puede traer VARIOS medicamentos — cada uno se muestra como su propia
// tarjeta, y elegir uno arranca el flujo de empaque + antes/después para
// ESE medicamento específico (no para toda la atención de una vez).
export default function Atenciones() {
  useRequireProfessional();
  const r = useRouter();
  const [documentNumber, setDocumentNumber] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [atenciones, setAtenciones] = useState<Atencion[]>([]);

  async function cargar(doc: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/atenciones?documentNumber=${encodeURIComponent(doc)}&status=pendiente`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las atenciones.');
      setAtenciones(json.atenciones || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las atenciones.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const s = getSession();
    setDocumentNumber(s.patientDocNumber);
    if (s.patientDocNumber) {
      cargar(s.patientDocNumber);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegir(a: Atencion, m: Medicamento) {
    updateSession({
      atencionId: a.id,
      atencionMedicationId: m.id,
      atencionProduct: m.product,
      atencionGtin: m.gtin || undefined,
      atencionLot: m.lot || undefined,
      atencionExpiry: m.expiry || undefined,
    });
    r.push('/nfc');
  }

  function continuarSinAtencion() {
    // Modo prueba/demo: paciente sin documento (p.ej. "Paciente de
    // prueba") o sin atenciones cargadas todavía por el sistema externo.
    updateSession({
      atencionId: undefined,
      atencionMedicationId: undefined,
      atencionProduct: undefined,
      atencionGtin: undefined,
      atencionLot: undefined,
      atencionExpiry: undefined,
    });
    r.push('/nfc');
  }

  const totalMedicamentos = atenciones.reduce((n, a) => n + a.medications.length, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header stepIndex={3} stepLabel="Medicamentos" />
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-5">
          <p className="text-sm font-semibold text-teal-700">Paso 3 de 7 · Medicamentos</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Medicamentos pendientes</h1>
          <p className="mt-2 text-sm text-slate-500">
            {documentNumber
              ? 'Elige el medicamento que vas a administrar en esta sesión.'
              : 'Este paciente no tiene documento registrado, así que no se pueden buscar atenciones.'}
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
              !
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-950">No se pudieron cargar las atenciones</p>
              <p className="mt-1 text-sm text-red-900">{error}</p>
              {documentNumber && (
                <button
                  className="mt-3 min-h-10 rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700"
                  onClick={() => cargar(documentNumber)}
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && documentNumber && totalMedicamentos === 0 && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Este paciente no tiene atenciones pendientes en este momento.</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {atenciones.map((a) => (
              <div key={a.id} className="space-y-2">
                {a.externalReference && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Atención {a.externalReference}
                    {a.medications.length > 1 && ` · ${a.medications.length} medicamentos`}
                  </p>
                )}
                <div className="space-y-3">
                  {a.medications.map((m) => (
                    <button
                      key={m.id}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm active:scale-[0.99]"
                      onClick={() => elegir(a, m)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{m.product}</p>
                          {m.gtin && <p className="mt-1 text-sm text-slate-500">GTIN {m.gtin}</p>}
                        </div>
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                          Pendiente
                        </span>
                      </div>
                      {(m.lot || m.expiry) && (
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Lote</span>
                            <p className="font-semibold">{m.lot || '—'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Vence</span>
                            <p className="font-semibold">{m.expiry || '—'}</p>
                          </div>
                        </div>
                      )}
                      {m.notes && <p className="mt-2 text-sm text-slate-500">{m.notes}</p>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && documentNumber && (
          <button
            className="mt-5 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
            onClick={() => cargar(documentNumber)}
          >
            Actualizar lista
          </button>
        )}

        {!loading && (
          <button className="mt-3 w-full py-3 text-sm text-slate-500" onClick={continuarSinAtencion}>
            Continuar sin atención (modo prueba)
          </button>
        )}
      </main>
    </div>
  );
}
