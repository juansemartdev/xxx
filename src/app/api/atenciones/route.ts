import {NextRequest, NextResponse} from 'next/server';
import {ensureAtencionesSchema, getSql} from '@/lib/db';
import {normalizeDocumentNumber} from '@/lib/patientDoc';

export const runtime = 'nodejs';

type MedicationInput = {
  product?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  notes?: string;
};

type AtencionInput = {
  documentNumber?: string;
  externalReference?: string;
  notes?: string;
  medications?: MedicationInput[];
  // Atajo: una atención con un solo medicamento, sin necesidad de "medications".
  product?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
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

function medicationsOf(a: AtencionInput): MedicationInput[] {
  if (Array.isArray(a.medications) && a.medications.length > 0) return a.medications;
  if (a.product) return [{product: a.product, gtin: a.gtin, lot: a.lot, expiry: a.expiry}];
  return [];
}

// POST /api/atenciones — la llama un SISTEMA EXTERNO (no la app ChainDose)
// para crear una atención (con uno o más medicamentos) pendiente para un
// paciente. Requiere el header "x-api-key" con el valor de
// ATENCIONES_API_KEY.
//
// Body de una atención con varios medicamentos:
//   {documentNumber, externalReference?, notes?, medications: [{product, gtin?, lot?, expiry?}, ...]}
// Atajo si es un solo medicamento (sin "medications"):
//   {documentNumber, product, gtin?, lot?, expiry?, externalReference?, notes?}
// Para crear varias atenciones (de uno o varios pacientes) en una sola
// llamada: {atenciones: [ {...}, {...} ]}
export async function POST(req: NextRequest) {
  const authError = checkApiKey(req);
  if (authError) return authError;

  let body: AtencionInput | {atenciones?: AtencionInput[]};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }

  const batch: AtencionInput[] = Array.isArray((body as {atenciones?: AtencionInput[]}).atenciones)
    ? (body as {atenciones: AtencionInput[]}).atenciones
    : [body as AtencionInput];

  if (batch.length === 0) {
    return NextResponse.json({error: 'No se recibió ninguna atención para crear.'}, {status: 400});
  }

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const created: {atencionId: number; documentNumber: string; medicationIds: number[]}[] = [];

    for (const a of batch) {
      const documentNumber = normalizeDocumentNumber(a.documentNumber || '');
      const medications = medicationsOf(a);
      if (!documentNumber || medications.length === 0) {
        return NextResponse.json(
          {
            error:
              'Cada atención requiere documentNumber y al menos un medicamento (campo "medications", o "product" como atajo).',
            atencion: a,
          },
          {status: 400}
        );
      }
      for (const m of medications) {
        if (!m.product) {
          return NextResponse.json(
            {error: 'Cada medicamento requiere al menos "product".', medicamento: m},
            {status: 400}
          );
        }
      }

      const atencionRows = await sql`
        INSERT INTO atenciones (document_number, notes, external_reference)
        VALUES (${documentNumber}, ${a.notes || null}, ${a.externalReference || null})
        RETURNING id
      `;
      const atencionId = atencionRows[0].id as number;

      const medicationIds: number[] = [];
      for (const m of medications) {
        const rows = await sql`
          INSERT INTO atencion_medicamentos (atencion_id, product, gtin, lot, expiry, notes)
          VALUES (${atencionId}, ${m.product}, ${m.gtin || null}, ${m.lot || null}, ${m.expiry || null}, ${m.notes || null})
          RETURNING id
        `;
        medicationIds.push(rows[0].id as number);
      }

      created.push({atencionId, documentNumber, medicationIds});
    }

    return NextResponse.json({created});
  } catch (err) {
    console.error('atenciones create error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}

// GET /api/atenciones?documentNumber=...&status=pendiente — la llama la
// app ChainDose para mostrarle al profesional los medicamentos pendientes
// del paciente, agrupados por atención. Con status=pendiente (recomendado
// para /atenciones), cada atención devuelta solo trae los medicamentos que
// aún están pendientes (los ya completados no se listan aquí).
export async function GET(req: NextRequest) {
  const documentNumber = normalizeDocumentNumber(req.nextUrl.searchParams.get('documentNumber') || '');
  const status = req.nextUrl.searchParams.get('status') || undefined;
  if (!documentNumber) {
    return NextResponse.json({error: 'Falta el número de documento del paciente.'}, {status: 400});
  }

  try {
    await ensureAtencionesSchema();
    const sql = getSql();
    const atencionRows = await sql`
      SELECT * FROM atenciones WHERE document_number = ${documentNumber} ORDER BY created_at ASC
    `;
    if (atencionRows.length === 0) {
      return NextResponse.json({atenciones: []});
    }

    const atencionIds = atencionRows.map((r) => r.id as number);
    const medRows = status
      ? await sql`
          SELECT * FROM atencion_medicamentos
          WHERE atencion_id = ANY(${atencionIds}) AND status = ${status}
          ORDER BY created_at ASC
        `
      : await sql`
          SELECT * FROM atencion_medicamentos
          WHERE atencion_id = ANY(${atencionIds})
          ORDER BY created_at ASC
        `;

    const medsByAtencion = new Map<number, (typeof medRows)[number][]>();
    for (const m of medRows) {
      const key = m.atencion_id as number;
      const list = medsByAtencion.get(key) || [];
      list.push(m);
      medsByAtencion.set(key, list);
    }

    const atenciones = atencionRows
      .map((a) => {
        const meds = medsByAtencion.get(a.id as number) || [];
        return {
          id: a.id as number,
          documentNumber: a.document_number as string,
          externalReference: a.external_reference as string | null,
          notes: a.notes as string | null,
          status: a.status as string,
          createdAt: a.created_at as string,
          medications: meds.map((m) => ({
            id: m.id as number,
            product: m.product as string,
            gtin: m.gtin as string | null,
            lot: m.lot as string | null,
            expiry: m.expiry as string | null,
            notes: m.notes as string | null,
            status: m.status as string,
          })),
        };
      })
      // Si se filtró por status, no tiene sentido devolver atenciones sin
      // ningún medicamento que cumpla ese filtro.
      .filter((a) => !status || a.medications.length > 0);

    return NextResponse.json({atenciones});
  } catch (err) {
    console.error('atenciones list error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
