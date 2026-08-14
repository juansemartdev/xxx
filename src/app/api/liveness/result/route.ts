import {NextRequest, NextResponse} from 'next/server';
import {GetFaceLivenessSessionResultsCommand} from '@aws-sdk/client-rekognition';
import {getRekognitionClient, getMinLivenessConfidence} from '@/lib/aws';
import {bytesToBase64} from '@/lib/imageBytes';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {sessionId?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  if (!body.sessionId) return NextResponse.json({error: 'Falta sessionId.'}, {status: 400});

  try {
    const client = getRekognitionClient();
    const out = await client.send(
      new GetFaceLivenessSessionResultsCommand({SessionId: body.sessionId})
    );

    const confidence = out.Confidence ?? 0;
    const referenceImageBase64 = bytesToBase64(out.ReferenceImage?.Bytes);
    const minConfidence = getMinLivenessConfidence();

    return NextResponse.json({
      status: out.Status,
      confidence,
      isLive: out.Status === 'SUCCEEDED' && confidence >= minConfidence,
      referenceImageBase64,
    });
  } catch (err) {
    console.error('liveness result error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
