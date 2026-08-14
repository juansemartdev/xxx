import {NextResponse} from 'next/server';
import {CreateFaceLivenessSessionCommand} from '@aws-sdk/client-rekognition';
import {getRekognitionClient} from '@/lib/aws';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const client = getRekognitionClient();
    // Sin OutputConfig: Rekognition nos devuelve la imagen de referencia
    // como bytes directamente en GetFaceLivenessSessionResults, sin
    // necesidad de un bucket S3.
    const out = await client.send(new CreateFaceLivenessSessionCommand({}));
    if (!out.SessionId) {
      return NextResponse.json({error: 'Rekognition no devolvió un SessionId.'}, {status: 502});
    }
    return NextResponse.json({sessionId: out.SessionId});
  } catch (err) {
    console.error('liveness create-session error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
