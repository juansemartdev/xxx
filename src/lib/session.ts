export type Session = {
  patient?: string;
  tagId?: string;

  // Usuario profesional autenticado por biométrico (Face Liveness + Face
  // Match con AWS Rekognition), separado de "patient" que identifica al
  // paciente que recibe la dosis.
  professional?: string;

  // Datos de identidad capturados en /registro a partir de la cédula
  // colombiana (amarilla o digital). "patient" arriba se mantiene como
  // el nombre completo para mostrar en el resto del flujo.
  patientDocNumber?: string;
  patientFirstName?: string;
  patientMiddleName?: string;
  patientLastName?: string;
  patientSecondLastName?: string;
  patientBirthDate?: string;
  patientBloodType?: string;
  patientGender?: 'M' | 'F';
  // Foto del frente de la cédula (contiene la foto impresa de la persona),
  // capturada en /registro. Se usa como referencia para el Face Match del
  // paciente en /verificar-paciente.
  patientIdPhoto?: string;

  // Resultado de la verificación biométrica del paciente (Face Liveness +
  // Face Match contra la foto de la cédula) hecha en /verificar-paciente,
  // justo antes de administrar la dosis.
  patientLivenessConfidence?: number;
  patientFaceMatchSimilarity?: number;
  // null = todavía no se hizo la verificación.
  patientVerified?: boolean | null;
  patientVerificationNotes?: string;

  beforeProduct?: string;
  beforeGtin?: string;
  beforeLot?: string;
  beforeExpiry?: string;

  afterProduct?: string;
  afterGtin?: string;
  afterLot?: string;
  afterExpiry?: string;

  beforeWeight?: number;
  afterWeight?: number;
  beforePhoto?: string;
  afterPhoto?: string;

  // Resultado de la verificación por IA de si el vial en la foto DESPUÉS
  // se ve físicamente abierto/alterado (ver src/lib/vialCondition.ts).
  vialLooksOpened?: boolean | null;
  vialConditionConfidence?: 'alta' | 'media' | 'baja';
  vialConditionNotes?: string;

  // Evita registrar esta sesión más de una vez en el historial usado
  // para comparar pesos entre mediciones (ver src/lib/history.ts).
  historyRecorded?: boolean;
};
const KEY = 'chaindose-session';
export function getSession(): Session {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
export function updateSession(p: Partial<Session>) {
  const s = {...getSession(), ...p};
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
export function clearSession() {
  localStorage.removeItem(KEY);
}
