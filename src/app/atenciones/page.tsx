'use client';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import Header from '@/components/Header';
import {getSession, updateSession} from '@/lib/session';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

type Atencion = {
  id: number;
  documentNumber: string;
  product: string;
  gtin: string | null;
  lot: string | null;
  expiry: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
};

// Lista los medicamentos pendientes del paciente ya identificado/verificado
// (creados por un sistema externo vía POST /api/atenciones). Elegir uno
// arranca el flujo de empaque + antes/después para ESE medicamento.
export default function Atenciones() {
  useRequireProfessional();
  const r = useRouter();
  const [documentNumber, setDocumentNumber] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Atencion[]>([]);

  async function cargar(doc: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/atenciones?documentNumber=${encodeURIComponent(doc)}&status=pendiente`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudieron cargar las atenciones.');
      setItems(json.atenciones || []);
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

  function elegir(a: Atencion) {
    updateSession({
      atencionId: a.id,
      atencionProduct: a.product,
      atencionGtin: a.gtin || undefined,
      atencionLot: a.lot || undefined,
      atencionExpiry: a.expiry || undefined,
    });
    r.push('/nfc');
  }

  function continuarSinAtencion() {
    // Modo prueba/demo: paciente sin documento (p.ej. "Paciente de
    // prueba") o sin atenciones cargadas todavía por el sistema externo.
    updateSession({
      atencionId: undefined,
      atencionProduct: undefined,
      atencionGtin: undefined,
      atencionLot: undefined,
      atencionExpiry: undefined,
    });
    r.push('/nfc');
  }

  return (
    <>
      <Header step="Medicamentos pendientes" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">3 · Atenciones</div>
          <h1 className="text-2xl font-bold mt-2">Medicamentos pendientes</h1>
          <p className="sub">
            {documentNumber
              ? 'Elige el medicamento que vas a administrar en esta sesión.'
              : 'Este paciente no tiene documento registrado, así que no se pueden buscar atenciones.'}
          </p>
        </div>

        {loading && <p className="text-sm text-slate-500">Cargando…</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md p-2">{error}</p>}

        {!loading && documentNumber && items.length === 0 && !error && (
          <div className="card">
            <p className="sub">Este paciente no tiene atenciones pendientes en este momento.</p>
          </div>
        )}

        {!loading &&
          items.map((a) => (
            <button key={a.id} className="card text-left w-full" onClick={() => elegir(a)}>
              <div className="font-semibold">{a.product}</div>
              <div className="text-sm text-slate-500 mt-1">
                {a.lot && <>Lote: {a.lot} · </>}
                {a.expiry && <>Vence: {a.expiry}</>}
              </div>
              {a.notes && <div className="text-sm text-slate-500 mt-1">{a.notes}</div>}
            </button>
          ))}

        {!loading && documentNumber && (
          <button className="btn secondary" onClick={() => cargar(documentNumber)}>
            Actualizar lista
          </button>
        )}

        {!loading && (
          <button className="btn secondary" onClick={continuarSinAtencion}>
            Continuar sin atención (modo prueba)
          </button>
        )}
      </div>
    </>
  );
}
