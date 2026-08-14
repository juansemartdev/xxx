import {NextRequest, NextResponse} from 'next/server';
import {ensureLivenessSchema, getSql} from '@/lib/db';
import {normalizeUsername} from '@/lib/webauthnConfig';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {username?: string; referenceImageBase64?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const username = normalizeUsername(body.username || '');
  if (!username || !body.referenceImageBase64) {
    return NextResponse.json({error: 'Faltan datos para registrar el biométrico.'}, {status: 400});
  }

  try {
    await ensureLivenessSchema();
    const sql = getSql();
    await sql`
      INSERT INTO professional_biometrics (username, reference_image, updated_at)
      VALUES (${username}, ${body.referenceImageBase64}, now())
      ON CONFLICT (username) DO UPDATE SET reference_image = EXCLUDED.reference_image, updated_at = now()
    `;
    return NextResponse.json({enrolled: true});
  } catch (err) {
    console.error('professional-biometric enroll error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
