import {NextRequest, NextResponse} from 'next/server';
import {ensurePatientsSchema, getSql} from '@/lib/db';
import {normalizeDocumentNumber} from '@/lib/patientDoc';

export const runtime = 'nodejs';

type PatientBody = {
  documentNumber?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  secondLastName?: string;
  birthDate?: string;
  bloodType?: string;
  gender?: string;
  idPhotoBase64?: string;
  // Foto en vivo (Face Liveness) capturada en /registro — ver notas en
  // ensurePatientsSchema (src/lib/db.ts) sobre por qué es preferible a la
  // foto de la cédula para el Face Match futuro.
  referencePhotoBase64?: string;
};

// Guarda o actualiza un paciente (upsert por número de documento). Se llama
// desde /registro al terminar de escanear la cédula, para que el paciente
// quede disponible en el servidor y no solo en el navegador de ese
// dispositivo.
export async function POST(req: NextRequest) {
  let body: PatientBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }

  const documentNumber = normalizeDocumentNumber(body.documentNumber || '');
  if (!documentNumber || !body.firstName || !body.lastName) {
    return NextResponse.json(
      {error: 'Faltan datos obligatorios del paciente (documento, primer nombre y primer apellido).'},
      {status: 400}
    );
  }

  try {
    await ensurePatientsSchema();
    const sql = getSql();
    await sql`
      INSERT INTO patients (
        document_number, first_name, middle_name, last_name, second_last_name,
        birth_date, blood_type, gender, id_photo, reference_photo, updated_at
      ) VALUES (
        ${documentNumber}, ${body.firstName}, ${body.middleName || null}, ${body.lastName},
        ${body.secondLastName || null}, ${body.birthDate || null}, ${body.bloodType || null},
        ${body.gender || null}, ${body.idPhotoBase64 || null}, ${body.referencePhotoBase64 || null}, now()
      )
      ON CONFLICT (document_number) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        middle_name = EXCLUDED.middle_name,
        last_name = EXCLUDED.last_name,
        second_last_name = EXCLUDED.second_last_name,
        birth_date = EXCLUDED.birth_date,
        blood_type = EXCLUDED.blood_type,
        gender = EXCLUDED.gender,
        id_photo = EXCLUDED.id_photo,
        -- Solo se sobrescribe si esta vez SÍ llega una foto en vivo nueva;
        -- así un profesional que reescanea la cédula (por ejemplo para
        -- corregir un dato) sin repetir la captura de Face Liveness no
        -- borra la referencia que ya existía.
        reference_photo = COALESCE(EXCLUDED.reference_photo, patients.reference_photo),
        updated_at = now()
    `;
    return NextResponse.json({saved: true, documentNumber});
  } catch (err) {
    console.error('patients save error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}

// GET /api/patients?documentNumber=... — busca un paciente ya registrado,
// para reusarlo en una nueva sesión sin volver a escanear la cédula.
export async function GET(req: NextRequest) {
  const documentNumber = normalizeDocumentNumber(req.nextUrl.searchParams.get('documentNumber') || '');
  if (!documentNumber) {
    return NextResponse.json({error: 'Falta el número de documento a buscar.'}, {status: 400});
  }

  try {
    await ensurePatientsSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM patients WHERE document_number = ${documentNumber}`;
    if (rows.length === 0) {
      return NextResponse.json({found: false});
    }
    const p = rows[0];
    return NextResponse.json({
      found: true,
      documentNumber: p.document_number as string,
      firstName: p.first_name as string | null,
      middleName: p.middle_name as string | null,
      lastName: p.last_name as string | null,
      secondLastName: p.second_last_name as string | null,
      birthDate: p.birth_date as string | null,
      bloodType: p.blood_type as string | null,
      gender: p.gender as string | null,
      idPhotoBase64: p.id_photo as string | null,
      referencePhotoBase64: p.reference_photo as string | null,
    });
  } catch (err) {
    console.error('patients lookup error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
