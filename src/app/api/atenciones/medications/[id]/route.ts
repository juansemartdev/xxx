import {NextRequest, NextResponse} from 'next/server';
import {ensureAtencionesSchema, getSql} from '@/lib/db';

export const runtime = 'nodejs';

type MedicationUpdate = {
  status?: string;
  beforePhoto?: string;
  beforeProduct?: string;
  beforeGtin?: string;
  beforeLot?: string;
  beforeExpiry?: string;
  beforeWeight?: number;
  afterPhoto?: string;
  afterProduct?: string;
  afterGtin?: string;
  afterLot?: string;
  afterExpiry?: string;
  afterWeight?: number;
  vialLooksOpened?: boolean | null;
  vialConditionConfidence?: string;
  vialConditionNotes?: string;
};

// PATCH /api/atenciones/medications/:id — la llama la app ChainDose al
// cerrar una sesión de dosis (ver /complete) para marcar ESE medicamento
// como completado y guardar su evidencia (fotos antes/después, peso, lo
// escaneado del vial, condición del vial). Antes esta evidencia solo
// vivía en el localStorage del celular del profesional y se perdía si se
// borraba el navegador o se cambiaba de dispositivo; ahora queda aquí,
// consultable para auditoría.
//
// Cuando el medicamento pasa a "completada", se recalcula el estado
// agregado de la atención a la que pertenece a partir de TODOS sus
// medicamentos: "pendiente" (ninguno completado), "parcial" (algunos) o
// "completada" (todos) — así un sistema externo puede consultar el
// avance de la atención completa sin tener que sumar cada medicamento.
export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id: idParam} = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({error: 'Id de medicamento inválido.'}, {status: 400});
  }

  let body: MedicationUpdate;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const status = body.status || 'completada';
  const completing = status === 'completada';

  try {
    await ensureAtencionesSchema();
    const sql = getSql();

    const rows = await sql`
      UPDATE atencion_medicamentos SET
        status = ${status},
        before_photo = COALESCE(${body.beforePhoto ?? null}, before_photo),
        before_product = COALESCE(${body.beforeProduct ?? null}, before_product),
        before_gtin = COALESCE(${body.beforeGtin ?? null}, before_gtin),
        before_lot = COALESCE(${body.beforeLot ?? null}, before_lot),
        before_expiry = COALESCE(${body.beforeExpiry ?? null}, before_expiry),
        before_weight = COALESCE(${body.beforeWeight ?? null}, before_weight),
        after_photo = COALESCE(${body.afterPhoto ?? null}, after_photo),
        after_product = COALESCE(${body.afterProduct ?? null}, after_product),
        after_gtin = COALESCE(${body.afterGtin ?? null}, after_gtin),
        after_lot = COALESCE(${body.afterLot ?? null}, after_lot),
        after_expiry = COALESCE(${body.afterExpiry ?? null}, after_expiry),
        after_weight = COALESCE(${body.afterWeight ?? null}, after_weight),
        vial_looks_opened = COALESCE(${body.vialLooksOpened ?? null}, vial_looks_opened),
        vial_condition_confidence = COALESCE(${body.vialConditionConfidence ?? null}, vial_condition_confidence),
        vial_condition_notes = COALESCE(${body.vialConditionNotes ?? null}, vial_condition_notes),
        updated_at = now(),
        completed_at = CASE WHEN ${completing} THEN now() ELSE completed_at END
      WHERE id = ${id}
      RETURNING atencion_id
    `;
    if (rows.length === 0) {
      return NextResponse.json({error: 'No se encontró ese medicamento.'}, {status: 404});
    }
    const atencionId = rows[0].atencion_id as number;

    // Recalcula el estado agregado de la atención a partir de sus medicamentos.
    const siblings = await sql`SELECT status FROM atencion_medicamentos WHERE atencion_id = ${atencionId}`;
    const total = siblings.length;
    const done = siblings.filter((s) => s.status === 'completada').length;
    const atencionStatus = done === 0 ? 'pendiente' : done === total ? 'completada' : 'parcial';

    await sql`
      UPDATE atenciones SET
        status = ${atencionStatus},
        updated_at = now(),
        completed_at = CASE WHEN ${atencionStatus === 'completada'} THEN now() ELSE completed_at END
      WHERE id = ${atencionId}
    `;

    return NextResponse.json({updated: true, atencionId, atencionStatus});
  } catch (err) {
    console.error('atencion medication update error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
