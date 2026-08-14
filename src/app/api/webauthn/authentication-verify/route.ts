import {NextRequest, NextResponse} from 'next/server';
import {verifyAuthenticationResponse, type AuthenticationResponseJSON} from '@simplewebauthn/server';
import {ensureSchema, getSql} from '@/lib/db';
import {base64UrlToBytes, getRpInfo, normalizeUsername} from '@/lib/webauthnConfig';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {username?: string; response?: AuthenticationResponseJSON; challenge?: string};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({error: 'Cuerpo de solicitud inválido.'}, {status: 400});
  }
  const username = normalizeUsername(body.username || '');
  if (!username || !body.response || !body.challenge) {
    return NextResponse.json({error: 'Faltan datos de la solicitud.'}, {status: 400});
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT credential_id, public_key, counter, transports
      FROM webauthn_credentials
      WHERE username = ${username} AND credential_id = ${body.response.id}
    `;

    if (rows.length === 0) {
      return NextResponse.json({error: 'Credencial no encontrada para este usuario.'}, {status: 404});
    }
    const row = rows[0];

    const {rpID, origin} = getRpInfo(req);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: body.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credential_id as string,
        publicKey: base64UrlToBytes(row.public_key as string),
        counter: Number(row.counter),
        transports: row.transports ? ((row.transports as string).split(',') as any) : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({error: 'No se pudo verificar el biométrico.'}, {status: 400});
    }

    await sql`
      UPDATE webauthn_credentials
      SET counter = ${verification.authenticationInfo.newCounter}
      WHERE credential_id = ${row.credential_id as string}
    `;

    return NextResponse.json({verified: true, username});
  } catch (err) {
    console.error('authentication-verify error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
