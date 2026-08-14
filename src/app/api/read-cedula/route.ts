import {NextRequest, NextResponse} from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

// Verifica en console.anthropic.com/docs/models cuál nombre de modelo con
// visión tienes disponible en tu cuenta y ajústalo aquí o vía la variable
// de entorno ANTHROPIC_VISION_MODEL si hace falta.
const MODEL = process.env.ANTHROPIC_VISION_MODEL || 'claude-sonnet-4-5';

// Respaldo por OCR/visión para leer una cédula de ciudadanía colombiana
// (amarilla o digital/azul) cuando no se pudo leer o validar el PDF417
// del reverso (ver src/lib/cedulaPdf417.ts). La cédula digital SIEMPRE
// pasa por aquí, porque su código QR está cifrado y no es legible.
type CedulaReading = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  secondLastName: string | null;
  documentNumber: string | null;
  birthDate: string | null; // ISO yyyy-mm-dd
  bloodType: string | null;
  gender: 'M' | 'F' | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

const PROMPT = `Estas fotos muestran el frente y (si se incluye) el reverso de una cédula de ciudadanía colombiana (puede ser la laminada tradicional de color amarillo, o la cédula digital de color azul). Lee el texto impreso y responde EXCLUSIVAMENTE con un objeto JSON (sin texto adicional, sin markdown, sin explicación) con esta forma exacta:
{"firstName": string|null, "middleName": string|null, "lastName": string|null, "secondLastName": string|null, "documentNumber": string|null, "birthDate": string|null, "bloodType": string|null, "gender": "M"|"F"|null, "confidence": "alta"|"media"|"baja", "notes": string}

Reglas:
- "firstName"/"middleName": primer y segundo nombre, por separado, si son legibles. Si solo hay un nombre, usa "firstName" y deja "middleName" en null.
- "lastName"/"secondLastName": primer y segundo apellido, por separado.
- "documentNumber": el número de cédula (solo dígitos, sin puntos ni espacios).
- "birthDate": fecha de nacimiento en formato ISO "AAAA-MM-DD", si es legible.
- "bloodType": tipo de sangre y RH tal como aparece (por ejemplo "O+", "A-"), si es legible. Si no aparece en la foto, null.
- "gender": "M" o "F" según lo indicado en el documento, o null si no es legible.
- "confidence": "alta" si el texto es claramente legible, "media" si hay dudas menores, "baja" si la imagen está borrosa, con reflejos, o el texto no es claramente legible.
- "notes": una frase breve en español explicando cualquier ambigüedad o qué campos no pudiste leer (cadena vacía si no hay nada que aclarar).`;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {error: 'El servidor no tiene configurada ANTHROPIC_API_KEY.'},
      {status: 500}
    );
  }

  let body: {frontImage?: string; backImage?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }

  const images: {mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string}[] = [];
  for (const img of [body.frontImage, body.backImage]) {
    if (!img) continue;
    const match = img.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match) {
      return NextResponse.json(
        {error: 'Se esperaba una imagen en formato data URL (jpeg/png/webp).'},
        {status: 400}
      );
    }
    images.push({mediaType: match[1] as 'image/jpeg' | 'image/png' | 'image/webp', data: match[2]});
  }
  if (images.length === 0) {
    return NextResponse.json({error: 'No se recibió ninguna imagen.'}, {status: 400});
  }

  try {
    const anthropic = new Anthropic({apiKey: process.env.ANTHROPIC_API_KEY});
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((img) => ({
              type: 'image' as const,
              source: {type: 'base64' as const, media_type: img.mediaType, data: img.data},
            })),
            {type: 'text', text: PROMPT},
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);

    let parsed: CedulaReading;
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
    console.error('read-cedula error', err);
    const msg = err instanceof Error ? err.message : 'Error interno leyendo la cédula.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
