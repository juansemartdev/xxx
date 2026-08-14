import {NextResponse} from 'next/server';
import {AssumeRoleCommand} from '@aws-sdk/client-sts';
import {getStsClient, getLivenessRoleArn} from '@/lib/aws';

export const runtime = 'nodejs';

// Devuelve credenciales de AWS TEMPORALES (15 min) para que el navegador
// transmita el video de Face Liveness directo a Rekognition. El rol que se
// asume solo tiene permiso para "rekognition:StartFaceLivenessSession" —
// no puede hacer nada más en la cuenta de AWS, así que es seguro exponerlo
// al cliente.
export async function POST() {
  try {
    const sts = getStsClient();
    const out = await sts.send(
      new AssumeRoleCommand({
        RoleArn: getLivenessRoleArn(),
        RoleSessionName: `chaindose-liveness-${Date.now()}`,
        DurationSeconds: 900,
      })
    );
    const c = out.Credentials;
    if (!c || !c.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
      return NextResponse.json({error: 'No se pudieron obtener credenciales temporales de AWS.'}, {status: 502});
    }
    return NextResponse.json({
      accessKeyId: c.AccessKeyId,
      secretAccessKey: c.SecretAccessKey,
      sessionToken: c.SessionToken,
      expiration: c.Expiration,
    });
  } catch (err) {
    console.error('liveness credentials error', err);
    const msg = err instanceof Error ? err.message : 'Error interno.';
    return NextResponse.json({error: msg}, {status: 500});
  }
}
