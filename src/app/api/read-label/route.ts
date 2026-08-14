import {NextRequest, NextResponse} from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Verifica en console.anthropic.com/docs/models cuál nombre de modelo con
// visión tienes disponible en tu cuenta y ajústalo aquí o vía la variable
// de entorno ANTHROPIC_VISION_MODEL si hace falta.
const MODEL = process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-5';

// Respaldo de último recurso: solo se llama cuando no se pudo leer el
// DataMatrix del vial (ni como GS1 HRI ni como GS1 plano — ver
// src/lib/gs1.ts). En ese caso leemos el texto IMPRESO en la etiqueta
// directamente por OCR/visión. Es menos confiable que el código de
// barras porque depende de interpretar texto en una foto, así que
// siempre debe quedar editable por el usuario.
type LabelReading = {
  product: string | null;
  lot: string | null;
  expiry: string | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

const PROMPT = `No se pudo leer el código DataMatrix de este vial/ampolleta de medicamento, así que necesito que leas el TEXTO IMPRESO en la etiqueta directamente. Responde EXCLUSIVAMENTE con un objeto JSON (sin texto adicional, sin markdown, sin explicación) con esta forma exacta:
{"product": string|null, "lot": string|null, "expiry": string|null, "confidence": "alta"|"media"|"baja", "notes": string}

Reglas:
- "product": el nombre del medicamento/producto impreso en la etiqueta, si es legible. Si no, null.
- "lot": el número de lote/batch impreso en la etiqueta (a veces antecedido por "Lot", "Lote", "L", "Batch" o similar, o simplemente un código alfanumérico corto cerca de las fechas, como "RB6932"). Si no es legible, null.
- "expiry": la fecha de vencimiento impresa, en formato ISO "AAAA-MM-DD" (o "AAAA-MM" si no hay día). Si ves dos fechas en la etiqueta (fabricación y vencimiento), usa la fecha MÁS TARDÍA como vencimiento y menciona la otra en "notes". Si no hay ninguna fecha legible, usa null.
- "confidence": "alta" si el texto es claramente legible, "media" si hay dudas menores, "baja" si la imagen está borrosa, oscura, o el texto no es claramente legible.
- "notes": una frase breve en español explicando cualquier ambigüedad, qué campos no pudiste leer, o la fecha de fabricación si la identificaste (cadena vacía si no hay nada que aclarar).`;

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
      max_tokens: 400,
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

    let parsed: LabelReading;
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
    console.error('read-label error', err);
    const msg = err instanceof Error ? err.message : 'Error interno leyendo la etiqueta.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
