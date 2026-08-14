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

  // Atención (medicamento pendiente) elegida en /atenciones — viene de un
  // sistema externo que la creó vía POST /api/atenciones. beforeProduct/
  // beforeLot/etc. abajo son lo que se LEE del vial físico al escanearlo;
  // esto es lo PRESCRITO, solo informativo (no bloquea si no coincide).
  atencionId?: number;
  // Medicamento específico elegido dentro de esa atención (una atención
  // puede traer varios medicamentos — ver atencion_medicamentos en
  // src/lib/db.ts). Esto es lo que de verdad se completa en /complete.
  atencionMedicationId?: number;
  atencionProduct?: string;
  atencionGtin?: string;
  atencionLot?: string;
  atencionExpiry?: string;
  // Evita marcar el mismo medicamento como completado más de una vez si
  // el profesional recarga /complete.
  atencionCompleted?: boolean;

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

// Cierra el medicamento actual pero mantiene al paciente ya identificado
// y verificado (además del profesional), para administrar el SIGUIENTE
// medicamento pendiente del mismo paciente sin repetir la verificación
// biométrica. Se usa en /complete cuando el paciente tiene más
// medicamentos pendientes en /atenciones.
export function startNextMedication(): Session {
  const s = getSession();
  const kept: Session = {
    professional: s.professional,
    patient: s.patient,
    patientDocNumber: s.patientDocNumber,
    patientFirstName: s.patientFirstName,
    patientMiddleName: s.patientMiddleName,
    patientLastName: s.patientLastName,
    patientSecondLastName: s.patientSecondLastName,
    patientBirthDate: s.patientBirthDate,
    patientBloodType: s.patientBloodType,
    patientGender: s.patientGender,
    patientIdPhoto: s.patientIdPhoto,
    patientLivenessConfidence: s.patientLivenessConfidence,
    patientFaceMatchSimilarity: s.patientFaceMatchSimilarity,
    patientVerified: s.patientVerified,
    patientVerificationNotes: s.patientVerificationNotes,
  };
  localStorage.setItem(KEY, JSON.stringify(kept));
  return kept;
}

// Cierra la atención de UN paciente pero mantiene al profesional logueado,
// para poder seguir atendiendo pacientes sin volver a pasar por Face
// Liveness cada vez. Se usa en /complete al terminar una dosis ("Atender
// otro paciente" ya no cierra sesión del profesional, solo limpia al
// paciente y los datos de la dosis). Para cerrar sesión de verdad, usar
// clearSession().
export function startNewEncounter(): Session {
  const s = getSession();
  const kept: Session = {professional: s.professional};
  localStorage.setItem(KEY, JSON.stringify(kept));
  return kept;
}
