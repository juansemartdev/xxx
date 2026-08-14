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
  // Nota a nivel de la atención completa (encabezado). No confundir con
  // "notes" dentro de cada medicamento, que es específico de ese ítem.
  notes?: string;
  // Una atención puede traer varios medicamentos (mismo paciente, misma
  // orden/referencia externa): se listan aquí.
  medications?: MedicationInput[];
  // Atajo para el caso más común (una atención = un solo medicamento): se
  // pueden mandar los campos del medicamento directo en el objeto, sin
  // necesidad de envolverlos en "medications".
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

// POST /api/atenciones — la llama un SISTEMA EXTERNO (no la app Probattio)
// para crear una o varias atenciones pendientes para un paciente. Requiere
// el header "x-api-key" con el valor de ATENCIONES_API_KEY. Acepta un solo
// objeto o {items: [...]} para crear varias atenciones de una vez. Cada
// atención puede traer un solo medicamento (campos product/gtin/lot/expiry
// directo en el objeto) o varios (array "medications").
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
    const created: {id: number; documentNumber: string; medicationsCreated: number}[] = [];

    for (const item of items) {
      const documentNumber = normalizeDocumentNumber(item.documentNumber || '');
      if (!documentNumber) {
        return NextResponse.json({error: 'Cada atención requiere documentNumber.', item}, {status: 400});
      }

      // Acepta tanto el atajo (product/gtin/lot/expiry directo en el
      // objeto, para el caso de un solo medicamento) como el array
      // "medications" (para varios medicamentos en la misma atención).
      const medications: MedicationInput[] =
        Array.isArray(item.medications) && item.medications.length > 0
          ? item.medications
          : item.product
            ? [{product: item.product, gtin: item.gtin, lot: item.lot, expiry: item.expiry}]
            : [];

      if (medications.length === 0 || medications.some((m) => !m.product)) {
        return NextResponse.json(
          {error: 'Cada atención requiere al menos un medicamento con "product" (directo o dentro de "medications").', item},
          {status: 400}
        );
      }

      const atencionRows = await sql`
        INSERT INTO atenciones (document_number, external_reference, notes)
        VALUES (${documentNumber}, ${item.externalReference || null}, ${item.notes || null})
        RETURNING id
      `;
      const atencionId = atencionRows[0].id as number;

      for (const med of medications) {
        await sql`
          INSERT INTO atencion_medicamentos (atencion_id, product, gtin, lot, expiry, notes)
          VALUES (
            ${atencionId}, ${med.product}, ${med.gtin || null}, ${med.lot || null},
            ${med.expiry || null}, ${med.notes || null}
          )
        `;
      }

      created.push({id: atencionId, documentNumber, medicationsCreated: medications.length});
    }

    return NextResponse.json({created});
  } catch (err) {
    console.error('atenciones create error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}

// GET /api/atenciones?documentNumber=...&status=pendiente — la llama la app
// Probattio (no requiere API key: sigue el mismo modelo de confianza que
// /api/patients, ver notas de seguridad pendientes en el roadmap) para
// mostrarle al profesional los medicamentos pendientes del paciente. El
// filtro "status" aplica sobre cada MEDICAMENTO (no sobre la atención
// completa): una atención con medicamentos mixtos solo muestra los que
// coinciden, y si ninguno coincide la atención completa se omite.
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
      SELECT * FROM atenciones
      WHERE document_number = ${documentNumber}
      ORDER BY created_at ASC
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

    const medsByAtencion = new Map<number, {id: number; product: string; gtin: string | null; lot: string | null; expiry: string | null; notes: string | null; status: string}[]>();
    for (const m of medRows) {
      const atencionId = m.atencion_id as number;
      const list = medsByAtencion.get(atencionId) || [];
      list.push({
        id: m.id as number,
        product: m.product as string,
        gtin: m.gtin as string | null,
        lot: m.lot as string | null,
        expiry: m.expiry as string | null,
        notes: m.notes as string | null,
        status: m.status as string,
      });
      medsByAtencion.set(atencionId, list);
    }

    const atenciones = atencionRows
      .map((a) => ({
        id: a.id as number,
        documentNumber: a.document_number as string,
        externalReference: a.external_reference as string | null,
        notes: a.notes as string | null,
        status: a.status as string,
        createdAt: a.created_at as string,
        medications: medsByAtencion.get(a.id as number) || [],
      }))
      // Si se filtró por status y esta atención no tiene ningún
      // medicamento que coincida, no tiene sentido mostrarla vacía.
      .filter((a) => !status || a.medications.length > 0);

    return NextResponse.json({atenciones});
  } catch (err) {
    console.error('atenciones list error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
