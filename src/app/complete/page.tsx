'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import {getSession, startNewEncounter, updateSession, Session} from '@/lib/session';
import {appendHistory, deviationFromHistory} from '@/lib/history';
import {useRequireProfessional} from '@/lib/useRequireProfessional';

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

    // Marca la atención elegida como completada en el servidor, para que
    // deje de aparecer en la lista de pendientes del paciente. Una sola
    // vez por sesión (atencionCompleted evita reintentar en cada render).
    if (session.atencionId && !session.atencionCompleted) {
      updateSession({atencionCompleted: true});
      fetch(`/api/atenciones/${session.atencionId}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status: 'completada'}),
      }).catch(() => {
        // No bloqueamos el cierre de sesión por esto; si falla, la atención
        // queda pendiente y el profesional puede volver a elegirla luego.
      });
    }
  }, []);

  const diff =
    s.beforeWeight != null && s.afterWeight != null
      ? (s.beforeWeight - s.afterWeight).toFixed(3)
      : '—';
  const needsAudit = auditReasons.length > 0;

  return (
    <>
      <Header step="Sesión completada" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">7 · Registro cerrado</div>
          <h1 className="text-3xl font-extrabold mt-2">✓ Sesión completa</h1>
          <div className="status text-green-700 bg-green-50 mt-4">
            <span className="dot" />
            Evidencia registrada
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <span>Paciente</span>
            <b>{s.patient || '—'}</b>
          </div>
          {s.atencionProduct && (
            <div className="metric">
              <span>Atención (prescrito)</span>
              <b>
                {s.atencionProduct}
                {s.atencionLot ? ` · Lote ${s.atencionLot}` : ''}
              </b>
            </div>
          )}
          <div className="metric">
            <span>Tag NFC</span>
            <b>{s.tagId || '—'}</b>
          </div>
          <div className="metric">
            <span>Producto</span>
            <b>{s.beforeProduct || s.afterProduct || '—'}</b>
          </div>
          <div className="metric">
            <span>GTIN</span>
            <b>{s.beforeGtin || s.afterGtin || '—'}</b>
          </div>
          <div className="metric">
            <span>Lote (antes)</span>
            <b>{s.beforeLot || '—'}</b>
          </div>
          <div className="metric">
            <span>Lote (después)</span>
            <b>{s.afterLot || '—'}</b>
          </div>
          <div className="metric">
            <span>Vencimiento (antes)</span>
            <b>{s.beforeExpiry || '—'}</b>
          </div>
          <div className="metric">
            <span>Vencimiento (después)</span>
            <b>{s.afterExpiry || '—'}</b>
          </div>
          <div className="metric">
            <span>Peso ANTES</span>
            <b>{s.beforeWeight ?? '—'} g</b>
          </div>
          <div className="metric">
            <span>Peso DESPUÉS</span>
            <b>{s.afterWeight ?? '—'} g</b>
          </div>
          <div className="metric">
            <span>Diferencia de masa</span>
            <b>{diff} g</b>
          </div>
          <div className="metric">
            <span>Verificación de identidad del paciente</span>
            <b>
              {s.patientVerified === true
                ? '✓ Confirmada'
                : s.patientVerified === false
                ? '✗ No confirmada'
                : '— No realizada'}
            </b>
          </div>
        </div>

        <div className={`card ${needsAudit ? 'border-red-300' : ''}`}>
          <div className="step">Auditoría</div>
          {needsAudit ? (
            <>
              <div className="status text-red-700 bg-red-50 mt-2">
                <span className="dot" />
                Esta sesión debe enviarse a auditoría
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700 list-disc pl-5">
                {auditReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <div className="status text-green-700 bg-green-50 mt-2">
              <span className="dot" />
              No requiere auditoría
            </div>
          )}
        </div>

        <button
          className="btn primary"
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
        <Link href="/session" className="btn secondary block text-center">
          Volver al inicio (sigues logueado)
        </Link>
      </div>
    </>
  );
}
