import postgres from 'postgres';

// Funciona con cualquier Postgres estándar (Supabase, Neon, etc.) — no
// depende de un driver propietario. Para Supabase en Vercel (serverless),
// usa la cadena de conexión del "Transaction pooler" (puerto 6543, ver
// .env.example): está pensada justo para muchas conexiones cortas y
// simultáneas como las de funciones serverless.
//
// El cliente se crea una sola vez y se reutiliza entre invocaciones cálidas
// de la función (patrón recomendado tanto por Supabase como por postgres.js).
let client: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta la variable de entorno DATABASE_URL. Conecta una base de datos Postgres (por ejemplo Supabase, plan gratuito) antes de usar biometría.'
    );
  }
  client = postgres(url, {
    ssl: 'require',
    // El modo "transaction" del pooler de Supabase (Supavisor) no soporta
    // prepared statements — hay que desactivarlos explícitamente.
    prepare: false,
  });
  return client;
}

let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      device_type TEXT,
      backed_up BOOLEAN,
      transports TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_webauthn_username ON webauthn_credentials (username)`;
  schemaReady = true;
}

let livenessSchemaReady = false;

// Guarda, por profesional, la imagen de referencia capturada durante su
// primer registro biométrico (Face Liveness + AWS Rekognition). En logins
// posteriores se compara la nueva captura contra esta referencia con
// CompareFaces. La imagen se guarda en base64 directamente en la fila
// (son fotos pequeñas de un solo rostro, no hace falta un bucket S3 aparte).
export async function ensureLivenessSchema() {
  if (livenessSchemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS professional_biometrics (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      reference_image TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  livenessSchemaReady = true;
}
