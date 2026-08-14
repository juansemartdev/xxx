import {NextRequest, NextResponse} from 'next/server';
import {verifyRegistrationResponse, type RegistrationResponseJSON} from '@simplewebauthn/server';
import {ensureSchema, getSql} from '@/lib/db';
import {bytesToBase64Url, getRpInfo, normalizeUsername} from '@/lib/webauthnConfig';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: {username?: string; response?: RegistrationResponseJSON; challenge?: string};
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
    const {rpID, origin} = getRpInfo(req);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: body.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({error: 'No se pudo verificar el registro biométrico.'}, {status: 400});
    }

    const {credential, credentialDeviceType, credentialBackedUp} = verification.registrationInfo;

    await ensureSchema();
    const sql = getSql();
    await sql`
      INSERT INTO webauthn_credentials (username, credential_id, public_key, counter, device_type, backed_up, transports)
      VALUES (
        ${username},
        ${credential.id},
        ${bytesToBase64Url(credential.publicKey)},
        ${credential.counter},
        ${credentialDeviceType},
        ${credentialBackedUp},
        ${credential.transports ? credential.transports.join(',') : null}
      )
      ON CONFLICT (credential_id) DO NOTHING
    `;

    return NextResponse.json({verified: true});
  } catch (err) {
    console.error('registration-verify error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
