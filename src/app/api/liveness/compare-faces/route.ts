import {NextRequest, NextResponse} from 'next/server';
import {CompareFacesCommand} from '@aws-sdk/client-rekognition';
import {getRekognitionClient, getMinFaceMatchSimilarity} from '@/lib/aws';
import {dataUrlToBytes} from '@/lib/imageBytes';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {sourceImageBase64?: string; targetImageBase64?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  if (!body.sourceImageBase64 || !body.targetImageBase64) {
    return NextResponse.json({error: 'Faltan imágenes para comparar.'}, {status: 400});
  }

  try {
    const client = getRekognitionClient();
    const minSimilarity = getMinFaceMatchSimilarity();
    const out = await client.send(
      new CompareFacesCommand({
        SourceImage: {Bytes: dataUrlToBytes(body.sourceImageBase64)},
        TargetImage: {Bytes: dataUrlToBytes(body.targetImageBase64)},
        SimilarityThreshold: minSimilarity,
      })
    );

    const bestMatch = out.FaceMatches?.[0];
    const similarity = bestMatch?.Similarity ?? 0;

    return NextResponse.json({
      matched: similarity >= minSimilarity,
      similarity,
      facesDetectedInSource: !!out.SourceImageFace,
      facesDetectedInTarget: (out.FaceMatches?.length ?? 0) + (out.UnmatchedFaces?.length ?? 0) > 0,
    });
  } catch (err) {
    console.error('compare-faces error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    // InvalidParameterException ocurre cuando no se detecta cara en alguna
    // de las dos imágenes: lo devolvemos como resultado "no coincide" en
    // vez de error 500, para que la UI lo muestre como fallo de verificación.
    if (msg.includes('no face') || msg.toLowerCase().includes('invalidparameter')) {
      return NextResponse.json({matched: false, similarity: 0, notes: 'No se detectó un rostro claro en una de las imágenes.'});
    }
    return NextResponse.json({error: msg}, {status: 500});
  }
}
