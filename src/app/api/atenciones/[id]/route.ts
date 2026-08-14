import {NextRequest, NextResponse} from 'next/server';
import {ensureAtencionesSchema, getSql} from '@/lib/db';

export const runtime = 'nodejs';

// PATCH /api/atenciones/:id — la llama la app ChainDose al cerrar una
// sesión de dosis (ver /complete) para marcar esa atención como
// "completada" y que deje de aparecer en la lista de pendientes del
// paciente.
export async function PATCH(req: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const {id: idParam} = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({error: 'Id de atención inválido.'}, {status: 400});
  }

  let body: {status?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const status = body.status || 'completada';

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const rows = await sql`
      UPDATE atenciones
      SET status = ${status}, updated_at = now(), completed_at = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json({error: 'No se encontró esa atención.'}, {status: 404});
    }
    return NextResponse.json({updated: true});
  } catch (err) {
    console.error('atenciones update error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
