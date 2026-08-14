import {NextRequest, NextResponse} from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Verifica en console.anthropic.com/docs/models cuál nombre de modelo con
// visión tienes disponible en tu cuenta y ajústalo aquí o vía la variable
// de entorno ANTHROPIC_VISION_MODEL si hace falta.
const MODEL = process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-5';

// Se usa solo sobre la foto DESPUÉS, como una de las señales para decidir
// si la sesión debe ir a auditoría: un vial que no muestra señales de
// haber sido abierto/alterado es sospechoso si se supone que ya se
// extrajo una dosis de él.
type VialCondition = {
  looksOpened: boolean | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

const PROMPT = `Esta foto muestra un vial/ampolleta de medicamento en la etapa DESPUÉS de su uso (posterior a la extracción de una dosis). Evalúa si el vial se ve físicamente abierto o alterado, comparado con cómo se vería un vial nuevo sin usar. Responde EXCLUSIVAMENTE con un objeto JSON (sin texto adicional, sin markdown, sin explicación) con esta forma exacta:
{"looksOpened": boolean|null, "confidence": "alta"|"media"|"baja", "notes": string}

Señales de que SÍ fue abierto/alterado: tapa o sello de seguridad roto, doblado o removido; septum/tapón de goma perforado o con marca visible de aguja; anillo de garantía (tamper ring) roto o ausente; tapa faltante; vial visiblemente destapado.

Reglas:
- "looksOpened": true si ves señales claras de apertura/alteración. false si el vial se ve intacto, con su tapa y sello originales, sin señales de uso. null si la foto no permite evaluarlo con algo de confianza (mal enfocada, el vial/tapa no es claramente visible, ángulo inadecuado).
- "confidence": "alta" si la evidencia (o falta de ella) es clara, "media" si hay dudas menores, "baja" si la imagen no permite ver bien la zona relevante del vial.
- "notes": una frase breve en español describiendo qué observaste (o por qué no se pudo evaluar).`;

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
      max_tokens: 300,
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

    let parsed: VialCondition;
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
    console.error('check-vial-condition error', err);
    const msg = err instanceof Error ? err.message : 'Error interno evaluando la condición del vial.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
