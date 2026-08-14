import {NextRequest, NextResponse} from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Verifica en console.anthropic.com/docs/models cuál nombre de modelo con
// visión tienes disponible en tu cuenta y ajústalo aquí o vía la variable
// de entorno ANTHROPIC_VISION_MODEL si hace falta.
const MODEL = process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-5';

// El GTIN, lote y vencimiento del vial se leen del DataMatrix (ver
// src/lib/scanDataMatrix.ts + src/lib/gs1.ts) porque son datos exactos y
// estructurados. Este endpoint solo se encarga de lo que sí requiere
// visión: leer el número que muestra el display de la báscula.
type WeightAnalysis = {
  digitsSeen: string | null;
  unit: string | null;
  weight: number | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

const PROMPT = `Esta foto muestra un vial de medicamento colocado sobre una báscula digital. Tu única tarea es leer el número que muestra el display de la báscula. Responde EXCLUSIVAMENTE con un objeto JSON (sin texto adicional, sin markdown, sin explicación) con esta forma exacta:
{"digitsSeen": string|null, "unit": string|null, "weight": number|null, "confidence": "alta"|"media"|"baja", "notes": string}

Reglas:
- "digitsSeen": copia EXACTA de los dígitos y el separador decimal (punto o coma) que muestra el display numérico de la báscula, y NADA MÁS. No incluyas ninguna letra de unidad (g, kg, lb, oz) aunque esté pegada o cerca del número. Por ejemplo, si el display muestra un "6" grande con una "g" pequeña de unidad al lado, digitsSeen debe ser exactamente "6" — nunca "6.9", "6g" ni ninguna variante que incorpore la "g". Si no puedes leer ningún dígito con certeza, usa null.
- "unit": la unidad de medida que muestra el display, leída por separado de los dígitos (por ejemplo "g", "kg"), o null si no es claramente visible.
- "weight": el valor numérico que representa exactamente "digitsSeen" (usa punto decimal, no coma), sin dígitos inventados ni redondeos. Si "digitsSeen" es null, "weight" también debe ser null.
- "confidence": "alta" solo si el display es claramente legible y no hay ninguna ambigüedad entre los dígitos y la letra de unidad. "media" si hay dudas menores. "baja" si la imagen está borrosa, oscura, o el display no es claramente legible.
- "notes": una frase breve en español explicando cualquier ambigüedad, el motivo de baja confianza, o si la unidad detectada no es gramos (cadena vacía si no hay ninguna).`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {error: 'El servidor no tiene configurada ANTHROPIC_API_KEY.'},
      {status: 500}
    );
  }

  let body: {image?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }

  const image = body.image;
  const match = image?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      {error: 'Se esperaba una imagen en formato data URL (jpeg/png/webp).'},
      {status: 400}
    );
  }
  const [, mediaType, base64Data] = match;

  try {
    const anthropic = new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY});
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64Data,
              },
            },
            {type: 'text', text: PROMPT},
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    let parsed: WeightAnalysis;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return NextResponse.json(
        {error: 'No se pudo interpretar la respuesta del modelo.', raw},
        {status: 502}
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error('analyze-vial error', err);
    const msg = err instanceof Error ? err.message : 'Error interno analizando la imagen.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
