import {NextRequest, NextResponse} from 'next/server';
import {ensureAtencionesSchema, getSql} from '@/lib/db';
import {normalizeDocumentNumber} from '@/lib/patientDoc';

export const runtime = 'nodejs';

type AtencionInput = {
  documentNumber?: string;
  product?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  notes?: string;
  externalReference?: string;
};

function checkApiKey(req: NextRequest): NextResponse | null {
  const expected = process.env.ATENCIONES_API_KEY;
  if (!expected) {
    return NextResponse.json(
      {error: 'Falta configurar la variable de entorno ATENCIONES_API_KEY en el servidor.'},
      {status: 500}
    );
  }
  const provided = req.headers.get('x-api-key');
  if (provided !== expected) {
    return NextResponse.json({error: 'API key inválida o faltante (header x-api-key).'}, {status: 401});
  }
  return null;
}

// POST /api/atenciones — la llama un SISTEMA EXTERNO (no la app ChainDose)
// para crear una o varias atenciones pendientes para un paciente. Requiere
// el header "x-api-key" con el valor de ATENCIONES_API_KEY. Acepta un solo
// objeto o {items: [...]} para crear varias de una vez.
export async function POST(req: NextRequest) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  let body: AtencionInput | {items?: AtencionInput[]};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }

  const items: AtencionInput[] = Array.isArray((body as {items?: AtencionInput[]}).items)
    ? (body as {items: AtencionInput[]}).items
    : [body as AtencionInput];

  if (items.length === 0) {
    return NextResponse.json({error: 'No se recibió ninguna atención para crear.'}, {status: 400});
  }

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const created: {id: number; documentNumber: string}[] = [];

    for (const item of items) {
      const documentNumber = normalizeDocumentNumber(item.documentNumber || '');
      if (!documentNumber || !item.product) {
        return NextResponse.json(
          {error: 'Cada atención requiere al menos documentNumber y product.', item},
          {status: 400}
        );
      }
      const rows = await sql`
        INSERT INTO atenciones (document_number, product, gtin, lot, expiry, notes, external_reference)
        VALUES (
          ${documentNumber}, ${item.product}, ${item.gtin || null}, ${item.lot || null},
          ${item.expiry || null}, ${item.notes || null}, ${item.externalReference || null}
        )
        RETURNING id
      `;
      created.push({id: rows[0].id as number, documentNumber});
    }

    return NextResponse.json({created});
  } catch (err) {
    console.error('atenciones create error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}

// GET /api/atenciones?documentNumber=...&status=pendiente — la llama la app
// ChainDose (no requiere API key: sigue el mismo modelo de confianza que
// /api/patients, ver notas de seguridad pendientes en el roadmap) para
// mostrarle al profesional los medicamentos pendientes del paciente.
export async function GET(req: NextRequest) {
  const documentNumber = normalizeDocumentNumber(req.nextUrl.searchParams.get('documentNumber') || '');
  const status = req.nextUrl.searchParams.get('status') || undefined;
  if (!documentNumber) {
    return NextResponse.json({error: 'Falta el número de documento del paciente.'}, {status: 400});
  }

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const rows = status
      ? await sql`
          SELECT * FROM atenciones
          WHERE document_number = ${documentNumber} AND status = ${status}
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT * FROM atenciones
          WHERE document_number = ${documentNumber}
          ORDER BY created_at ASC
        `;

    return NextResponse.json({
      atenciones: rows.map((r) => ({
        id: r.id as number,
        documentNumber: r.document_number as string,
        product: r.product as string,
        gtin: r.gtin as string | null,
        lot: r.lot as string | null,
        expiry: r.expiry as string | null,
        notes: r.notes as string | null,
        status: r.status as string,
        createdAt: r.created_at as string,
      })),
    });
  } catch (err) {
    console.error('atenciones list error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
