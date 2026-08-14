import {NextRequest, NextResponse} from 'next/server';
import {generateAuthenticationOptions} from '@simplewebauthn/server';
import {ensureSchema, getSql} from '@/lib/db';
import {getRpInfo, normalizeUsername} from '@/lib/webauthnConfig';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {username?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const username = normalizeUsername(body.username || '');
  if (!username) return NextResponse.json({error: 'Falta el usuario.'}, {status: 400});

  try {
    await ensureSchema();
    const sql = getSql();
    const existing = await sql`
      SELECT credential_id, transports FROM webauthn_credentials WHERE username = ${username}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        {error: 'Este usuario no tiene un biométrico registrado todavía. Regístralo primero.'},
        {status: 404}
      );
    }

    const {rpID} = getRpInfo(req);
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      allowCredentials: existing.map((c) => ({
        id: c.credential_id as string,
        transports: c.transports ? ((c.transports as string).split(',') as any) : undefined,
      })),
    });

    return NextResponse.json(options);
  } catch (err) {
    console.error('authentication-options error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
