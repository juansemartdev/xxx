'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import {clearSession, getSession, updateSession, Session} from '@/lib/session';
import {appendHistory, deviationFromHistory} from '@/lib/history';

export default function Complete() {
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
          <div className="step">6 · Registro cerrado</div>
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
          className="btn secondary"
          onClick={() => {
            clearSession();
            location.href = '/session';
          }}
        >
          Nueva sesión
        </button>
        <Link href="/" className="btn primary block text-center">
          Inicio
        </Link>
      </div>
    </>
  );
}
