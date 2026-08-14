import {NextRequest, NextResponse} from 'next/server';
import {CompareFacesCommand} from '@aws-sdk/client-rekognition';
import {ensureLivenessSchema, getSql} from '@/lib/db';
import {normalizeUsername} from '@/lib/webauthnConfig';
import {getRekognitionClient, getMinFaceMatchSimilarity} from '@/lib/aws';
import {dataUrlToBytes} from '@/lib/imageBytes';

export const runtime = 'nodejs';

// Compara la captura de liveness recién hecha contra la imagen de
// referencia guardada en el registro del profesional. La imagen de
// referencia NUNCA se envía al navegador: solo entra y sale de este
// endpoint del servidor.
export async function POST(req: NextRequest) {
  let body: {username?: string; capturedImageBase64?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const username = normalizeUsername(body.username || '');
  if (!username || !body.capturedImageBase64) {
    return NextResponse.json({error: 'Faltan datos para verificar el biométrico.'}, {status: 400});
  }

  try {
    await ensureLivenessSchema();
    const sql = getSql();
    const rows = await sql`SELECT reference_image FROM professional_biometrics WHERE username = ${username}`;
    if (rows.length === 0) {
      return NextResponse.json(
        {enrolled: false, error: 'Este usuario no tiene un biométrico registrado todavía. Regístralo primero.'},
        {status: 404}
      );
    }

    const client = getRekognitionClient();
    const minSimilarity = getMinFaceMatchSimilarity();
    const out = await client.send(
      new CompareFacesCommand({
        SourceImage: {Bytes: dataUrlToBytes(rows[0].reference_image as string)},
        TargetImage: {Bytes: dataUrlToBytes(body.capturedImageBase64)},
        SimilarityThreshold: minSimilarity,
      })
    );

    const similarity = out.FaceMatches?.[0]?.Similarity ?? 0;
    return NextResponse.json({enrolled: true, matched: similarity >= minSimilarity, similarity});
  } catch (err) {
    console.error('professional-biometric verify error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    if (msg.toLowerCase().includes('invalidparameter')) {
      return NextResponse.json({enrolled: true, matched: false, similarity: 0, notes: 'No se detectó un rostro claro.'});
    }
    return NextResponse.json({error: msg}, {status: 500});
  }
}
