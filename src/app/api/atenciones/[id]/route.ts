import {NextRequest, NextResponse} from 'next/server';
import {ensureAtencionesSchema, getSql} from '@/lib/db';

export const runtime = 'nodejs';

// PATCH /api/atenciones/:id — actualización administrativa del
// ENCABEZADO de una atención (por ejemplo, para cancelarla o anotarla).
// El flujo normal de ChainDose NO usa esta ruta para marcar avance: cada
// medicamento se completa individualmente vía
// PATCH /api/atenciones/medications/:id, y el estado de la atención se
// recalcula solo a partir de sus medicamentos (ver esa ruta).
export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id: idParam} = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({error: 'Id de atención inválido.'}, {status: 400});
  }

  let body: {status?: string; notes?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  if (!body.status && body.notes === undefined) {
    return NextResponse.json({error: 'Nada para actualizar (status o notes).'}, {status: 400});
  }

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const rows = await sql`
      UPDATE atenciones SET
        status = COALESCE(${body.status ?? null}, status),
        notes = COALESCE(${body.notes ?? null}, notes),
        updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({error: 'No se encontró esa atención.'}, {status: 404});
    }
    return NextResponse.json({updated: true});
  } catch (err) {
    console.error('atencion header update error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
