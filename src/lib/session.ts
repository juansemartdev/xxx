export type Session = {
  patient?: string;
  tagId?: string;

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
