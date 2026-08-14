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

let patientsSchemaReady = false;

// Pacientes registrados por cédula (ver /registro). Antes solo vivían en el
// localStorage del navegador del profesional; ahora quedan en el servidor
// para poder buscarlos por número de documento desde cualquier dispositivo
// y reusarlos en sesiones futuras sin volver a escanear la cédula.
// document_number es UNIQUE: cada registro nuevo actualiza (upsert) al
// paciente existente en vez de duplicarlo.
export async function ensurePatientsSchema() {
  if (patientsSchemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      document_number TEXT NOT NULL UNIQUE,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      second_last_name TEXT,
      birth_date TEXT,
      blood_type TEXT,
      gender TEXT,
      id_photo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_patients_document ON patients (document_number)`;
  // La foto de la cédula puede ser vieja (la persona cambia con los años).
  // reference_photo es una foto EN VIVO capturada con Face Liveness durante
  // el registro (ver /registro), usada como referencia más confiable para
  // el Face Match en /verificar-paciente — si no existe (pacientes
  // registrados antes de este cambio, o que omitieron el paso), se sigue
  // usando id_photo como respaldo.
  await sql`ALTER TABLE patients ADD COLUMN IF NOT EXISTS reference_photo TEXT`;
  patientsSchemaReady = true;
}

let atencionesSchemaReady = false;

// "Atenciones": encargos de un sistema externo con uno o más medicamentos
// pendientes por aplicar a un paciente. Una atención = una "orden" (por
// ejemplo, todo lo que hay que aplicarle a un paciente en una visita); cada
// medicamento dentro de ella vive en atencion_medicamentos, con su propio
// lote/vencimiento y su propio ciclo antes/después — incluida la foto de
// evidencia, que aquí SÍ queda guardada en el servidor (antes solo vivía
// en el localStorage del celular del profesional y se perdía si se
// borraba el navegador o se cambiaba de dispositivo).
//
// ChainDose no las prescribe, solo las consume: las crea un sistema
// externo vía POST /api/atenciones (protegido con ATENCIONES_API_KEY), el
// profesional las ve en /atenciones después de identificar al paciente, y
// cada medicamento queda "completado" al cerrar su propia sesión de dosis
// (ver /complete). Cuando todos los medicamentos de una atención quedan
// completados, la atención misma pasa a "completada" automáticamente (si
// solo algunos, queda "parcial").
export async function ensureAtencionesSchema() {
  if (atencionesSchemaReady) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS atenciones (
      id SERIAL PRIMARY KEY,
      document_number TEXT NOT NULL,
      notes TEXT,
      external_reference TEXT,
      status TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_atenciones_document ON atenciones (document_number)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_atenciones_status ON atenciones (status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS atencion_medicamentos (
      id SERIAL PRIMARY KEY,
      atencion_id INTEGER NOT NULL REFERENCES atenciones (id) ON DELETE CASCADE,
      product TEXT NOT NULL,
      gtin TEXT,
      lot TEXT,
      expiry TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pendiente',

      -- Evidencia ANTES: lo escaneado/leído del vial físico (puede diferir
      -- de product/gtin/lot/expiry arriba, que es lo PRESCRITO) + la foto.
      before_photo TEXT,
      before_product TEXT,
      before_gtin TEXT,
      before_lot TEXT,
      before_expiry TEXT,
      before_weight DOUBLE PRECISION,

      -- Evidencia DESPUÉS, igual que arriba.
      after_photo TEXT,
      after_product TEXT,
      after_gtin TEXT,
      after_lot TEXT,
      after_expiry TEXT,
      after_weight DOUBLE PRECISION,

      -- Evaluación por IA de si el vial en la foto DESPUÉS se ve
      -- físicamente abierto/alterado.
      vial_looks_opened BOOLEAN,
      vial_condition_confidence TEXT,
      vial_condition_notes TEXT,

      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_atencion_medicamentos_atencion ON atencion_medicamentos (atencion_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_atencion_medicamentos_status ON atencion_medicamentos (status)`;

  // Migración desde el esquema anterior (una fila de "atenciones" = un
  // medicamento, sin tabla de detalle): si la columna "product" todavía
  // existe en atenciones, migramos cada fila a atencion_medicamentos y
  // luego la eliminamos. Corre una sola vez; después de la migración esta
  // columna ya no existe y este bloque no vuelve a hacer nada.
  const legacyColumn = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atenciones' AND column_name = 'product'
  `;
  if (legacyColumn.length > 0) {
    await sql`
      INSERT INTO atencion_medicamentos (atencion_id, product, gtin, lot, expiry, status, created_at, updated_at, completed_at)
      SELECT id, product, gtin, lot, expiry, status, created_at, updated_at, completed_at
      FROM atenciones
      WHERE product IS NOT NULL
    `;
    await sql`ALTER TABLE atenciones DROP COLUMN IF EXISTS product`;
    await sql`ALTER TABLE atenciones DROP COLUMN IF EXISTS gtin`;
    await sql`ALTER TABLE atenciones DROP COLUMN IF EXISTS lot`;
    await sql`ALTER TABLE atenciones DROP COLUMN IF EXISTS expiry`;
  }

  atencionesSchemaReady = true;
}
