import {RekognitionClient} from '@aws-sdk/client-rekognition';
import {STSClient} from '@aws-sdk/client-sts';

// Todas las llamadas a AWS Rekognition/STS ocurren únicamente en el
// servidor (rutas API de Next.js). El navegador nunca ve las credenciales
// de la cuenta de AWS: solo recibe credenciales temporales de un rol IAM
// muy restringido (ver /api/liveness/credentials), válidas por 15 minutos
// y con permiso exclusivo para iniciar la transmisión de Face Liveness.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${name}. Configura las credenciales de AWS (Rekognition Face Liveness) en Vercel antes de usar biometría.`
    );
  }
  return v;
}

export function getAwsRegion(): string {
  return requireEnv('AWS_REGION');
}

export function getRekognitionClient(): RekognitionClient {
  return new RekognitionClient({
    region: getAwsRegion(),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
}

export function getStsClient(): STSClient {
  return new STSClient({
    region: getAwsRegion(),
    credentials: {
      accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    },
  });
}

export function getLivenessRoleArn(): string {
  return requireEnv('AWS_LIVENESS_ROLE_ARN');
}

// Umbrales configurables por variable de entorno, con valores por defecto
// razonables si no se configuran.
export function getMinLivenessConfidence(): number {
  const v = Number(process.env.LIVENESS_MIN_CONFIDENCE);
  return Number.isFinite(v) && v > 0 ? v : 80;
}

export function getMinFaceMatchSimilarity(): number {
  const v = Number(process.env.FACE_MATCH_MIN_SIMILARITY);
  return Number.isFinite(v) && v > 0 ? v : 80;
}
