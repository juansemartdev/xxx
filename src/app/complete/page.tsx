'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {getSession, startNewEncounter, startNextMedication, updateSession, Session} from '@/lib/session';
import {appendHistory, deviationFromHistory} from '@/lib/history';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="flex justify-between py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export default function Complete() {
  useRequireProfessional();
  const [s, setS] = useState<Session>({});
  const [auditReasons, setAuditReasons] = useState<string[]>([]);

  useEffect(() => {
    const session = getSession();
    setS(session);

    const reasons: string[] = [];
    const gtin = session.beforeGtin || session.afterGtin;
    const product = session.beforeProduct || session.afterProduct;

    // Regla 1: peso final en cero — puede indicar que se está leyendo la
    // tara de la báscula en vez del peso real.
    if (session.afterWeight === 0) {
      reasons.push(
        'El peso DESPUÉS registrado es 0 g — podría estar usando la tara de la báscula en vez del peso real.'
      );
    }

    // Regla 2: el peso de esta muestra se desvía más de 10% respecto al
    // promedio de otras mediciones del mismo producto (historial local).
    if (session.beforeWeight != null) {
      const dev = deviationFromHistory(session.beforeWeight, 'beforeWeight', gtin, product);
      if (dev && dev.deviationPct > 10) {
        reasons.push(
          `El peso ANTES (${session.beforeWeight} g) varía ${dev.deviationPct.toFixed(1)}% respecto al ` +
            `promedio de otras ${dev.count} mediciones de este producto (${dev.avg.toFixed(3)} g).`
        );
      }
    }
    if (session.afterWeight != null) {
      const dev = deviationFromHistory(session.afterWeight, 'afterWeight', gtin, product);
      if (dev && dev.deviationPct > 10) {
        reasons.push(
          `El peso DESPUÉS (${session.afterWeight} g) varía ${dev.deviationPct.toFixed(1)}% respecto al ` +
            `promedio de otras ${dev.count} mediciones de este producto (${dev.avg.toFixed(3)} g).`
        );
      }
    }

    // Regla 3: el lote o el vencimiento no coinciden entre ANTES y
    // DESPUÉS (posible vial equivocado).
    if (session.beforeLot && session.afterLot && session.beforeLot !== session.afterLot) {
      reasons.push(`El lote no coincide entre ANTES (${session.beforeLot}) y DESPUÉS (${session.afterLot}).`);
    }
    if (session.beforeExpiry && session.afterExpiry && session.beforeExpiry !== session.afterExpiry) {
      reasons.push(
        `El vencimiento no coincide entre ANTES (${session.beforeExpiry}) y DESPUÉS (${session.afterExpiry}).`
      );
    }

    // Regla 4: el vial en la foto DESPUÉS no muestra señales de haber
    // sido abierto/alterado.
    if (session.vialLooksOpened === false) {
      reasons.push(
        session.vialConditionNotes ||
          'El vial en la foto DESPUÉS no muestra señales claras de haber sido abierto o alterado.'
      );
    }

    // Regla 5: la verificación biométrica del paciente (prueba de vida +
    // coincidencia facial con la foto de la cédula) falló o no se hizo.
    if (session.patientVerified === false) {
      reasons.push(
        session.patientVerificationNotes ||
          'La verificación biométrica del paciente no coincide o no se pudo confirmar presencia real.'
      );
    }

    // Regla 6: lo escaneado del vial real no coincide con lo prescrito en
    // la atención elegida (sistema externo). Solo informativo — no bloquea
    // el flujo, pero queda registrado para auditoría.
    if (session.atencionId) {
      const scannedLot = session.beforeLot || session.afterLot;
      if (session.atencionLot && scannedLot && session.atencionLot !== scannedLot) {
        reasons.push(
          `El lote escaneado del vial (${scannedLot}) no coincide con el prescrito en la atención (${session.atencionLot}).`
        );
      }
      const scannedProduct = session.beforeProduct || session.afterProduct;
      if (session.atencionProduct && scannedProduct && session.atencionProduct !== scannedProduct) {
        reasons.push(
          `El producto escaneado del vial (${scannedProduct}) no coincide con el prescrito en la atención (${session.atencionProduct}).`
        );
      }
      const scannedExpiry = session.beforeExpiry || session.afterExpiry;
      if (session.atencionExpiry && scannedExpiry && session.atencionExpiry !== scannedExpiry) {
        reasons.push(
          `El vencimiento escaneado del vial (${scannedExpiry}) no coincide con el prescrito en la atención (${session.atencionExpiry}).`
        );
      }
    }

    setAuditReasons(reasons);

    // Registramos esta sesión en el historial local (una sola vez) para
    // que futuras sesiones puedan compararse contra ella.
    if (!session.historyRecorded && (session.beforeWeight != null || session.afterWeight != null)) {
      appendHistory({
        timestamp: Date.now(),
        product,
        gtin,
        beforeWeight: session.beforeWeight,
        afterWeight: session.afterWeight,
      });
      updateSession({historyRecorded: true});
    }

    // Marca el medicamento elegido como completado en el servidor y le
    // adjunta toda la evidencia (fotos antes/después, peso, lo escaneado
    // del vial, condición del vial) para que quede como registro auditable
    // y deje de aparecer en la lista de pendientes del paciente. Antes esa
    // evidencia solo vivía en el localStorage del celular y se perdía; con
    // esto queda en el servidor. Una sola vez por sesión (atencionCompleted
    // evita reintentar en cada render).
    if (session.atencionMedicationId && !session.atencionCompleted) {
      updateSession({atencionCompleted: true});
      fetch(`/api/atenciones/medications/${session.atencionMedicationId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          status: 'completada',
          beforePhoto: session.beforePhoto,
          beforeProduct: session.beforeProduct,
          beforeGtin: session.beforeGtin,
          beforeLot: session.beforeLot,
          beforeExpiry: session.beforeExpiry,
          beforeWeight: session.beforeWeight,
          afterPhoto: session.afterPhoto,
          afterProduct: session.afterProduct,
          afterGtin: session.afterGtin,
          afterLot: session.afterLot,
          afterExpiry: session.afterExpiry,
          afterWeight: session.afterWeight,
          vialLooksOpened: session.vialLooksOpened,
          vialConditionConfidence: session.vialConditionConfidence,
          vialConditionNotes: session.vialConditionNotes,
        }),
      }).catch(() => {
        // No bloqueamos el cierre de sesión por esto; si falla, el
        // medicamento queda pendiente y el profesional puede volver a
        // elegirlo luego.
      });
    }
  }, []);

  const diff = s.beforeWeight != null && s.afterWeight != null ? (s.beforeWeight - s.afterWeight).toFixed(3) : '—';
  const needsAudit = auditReasons.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-xl px-4 pb-8">
        <div className="py-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl font-bold text-green-700">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Sesión completa</h1>
          <p className="mt-1 text-sm text-slate-500">La evidencia quedó registrada correctamente.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-900">Resumen de la administración</h2>
          <div className="mt-2 divide-y divide-slate-100">
            <Metric label="Paciente" value={s.patient || '—'} />
            {s.atencionProduct && (
              <Metric
                label="Atención prescrita"
                value={s.atencionProduct + (s.atencionLot ? ` · Lote ${s.atencionLot}` : '')}
              />
            )}
            <Metric label="Tag NFC" value={s.tagId || '—'} />
            <Metric label="Producto" value={s.beforeProduct || s.afterProduct || '—'} />
            <Metric label="GTIN" value={s.beforeGtin || s.afterGtin || '—'} />
            <Metric label="Lote antes / después" value={`${s.beforeLot || '—'} / ${s.afterLot || '—'}`} />
            <Metric label="Vencimiento antes / después" value={`${s.beforeExpiry || '—'} / ${s.afterExpiry || '—'}`} />
            <Metric label="Peso antes" value={s.beforeWeight != null ? `${s.beforeWeight} g` : '—'} />
            <Metric label="Peso después" value={s.afterWeight != null ? `${s.afterWeight} g` : '—'} />
            <div className="flex justify-between py-3">
              <span className="text-sm text-slate-500">Diferencia de masa</span>
              <span className="text-sm font-bold text-teal-700">{diff} g</span>
            </div>
            <Metric
              label="Verificación de identidad"
              value={s.patientVerified === true ? '✓ Confirmada' : s.patientVerified === false ? '✗ No confirmada' : '— No realizada'}
            />
          </div>
        </section>

        {needsAudit ? (
          <section className="mt-4 rounded-2xl border-2 border-red-400 bg-red-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-700">
                !
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-950">Esta sesión debe enviarse a auditoría</h2>
                <p className="mt-1 text-sm text-red-900">Se detectaron condiciones que requieren revisión.</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-white/70 p-3">
              <p className="text-sm font-semibold text-red-950">Motivos detectados</p>
              <ul className="mt-2 space-y-2 text-sm text-red-900">
                {auditReasons.map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <section className="mt-4 rounded-2xl border-2 border-green-200 bg-green-50 p-5">
            <h2 className="font-bold text-green-950">No requiere auditoría</h2>
            <p className="mt-1 text-sm text-green-900">Los controles de identidad, vial y peso no generaron alertas.</p>
          </section>
        )}

        <div className="mt-6 space-y-3">
          {s.patientDocNumber && (
            <button
              className="min-h-12 w-full rounded-xl bg-teal-700 px-5 font-semibold text-white shadow-sm active:scale-[0.98]"
              onClick={() => {
                // Mantiene al paciente ya identificado/verificado (y al
                // profesional) — para el siguiente medicamento pendiente de
                // este mismo paciente no hace falta repetir la verificación
                // biométrica.
                startNextMedication();
                location.href = '/atenciones';
              }}
            >
              Siguiente medicamento de este paciente
            </button>
          )}
          <button
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
            onClick={() => {
              // Mantiene al profesional logueado — solo limpia el paciente y
              // los datos de esta dosis, para poder seguir atendiendo sin
              // volver a pasar por Face Liveness.
              startNewEncounter();
              location.href = '/session';
            }}
          >
            Atender otro paciente
          </button>
          <Link
            href="/session"
            className="block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-700 active:scale-[0.98]"
          >
            Volver al inicio (sigues logueado)
          </Link>
        </div>
      </main>
    </div>
  );
}
