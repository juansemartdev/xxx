// Parser "best-effort" del PDF417 impreso en el reverso de la cédula de
// ciudadanía colombiana (la laminada, "amarilla").
//
// IMPORTANTE: el formato exacto del PDF417 de la cédula colombiana no
// está documentado oficialmente por la Registraduría. Estos offsets de
// byte están basados en proyectos open-source de terceros que hicieron
// ingeniería inversa del formato — no fueron verificados aquí contra una
// cédula real. Por eso:
//   1. SIEMPRE se valida que los campos extraídos tengan una forma
//      plausible (documento numérico, fecha válida, sexo M/F, etc.)
//      antes de confiar en ellos — si algo no calza, se descarta todo
//      el resultado (return null) y la pantalla cae a lectura por OCR.
//   2. El texto crudo decodificado queda expuesto para depuración: si en
//      la práctica esto falla con cédulas reales, compartan el "raw"
//      para ajustar los offsets.
//   3. Los datos extraídos, incluso si pasan la validación, deben
//      quedar siempre editables por el usuario.

export type CedulaPdf417Data = {
  documentNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  gender: 'M' | 'F';
  birthDate: string; // ISO yyyy-mm-dd
  bloodType?: string;
  raw: string;
};

export function bytesToLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function cleanField(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

export function parseCedulaPdf417(raw: string): CedulaPdf417Data | null {
  if (raw.length < 168) return null;

  const documentNumber = cleanField(raw.slice(48, 58)).replace(/\D/g, '');
  const lastName = cleanField(raw.slice(58, 81));
  const secondLastName = cleanField(raw.slice(81, 104));
  const firstName = cleanField(raw.slice(104, 127));
  const middleName = cleanField(raw.slice(127, 150));
  const gender = cleanField(raw.slice(151, 152)).toUpperCase();
  const birthYear = cleanField(raw.slice(152, 156));
  const birthMonth = cleanField(raw.slice(156, 158));
  const birthDay = cleanField(raw.slice(158, 160));
  const bloodType = cleanField(raw.slice(166, 168)).toUpperCase();

  const validDoc = /^\d{6,10}$/.test(documentNumber);
  const validGender = gender === 'M' || gender === 'F';
  const validYear = /^(19|20)\d{2}$/.test(birthYear) && Number(birthYear) <= new Date().getFullYear();
  const validMonth = /^(0[1-9]|1[0-2])$/.test(birthMonth);
  const validDay = /^(0[1-9]|[12]\d|3[01])$/.test(birthDay);
  const validName = firstName.length > 0 && lastName.length > 0;

  if (!validDoc || !validGender || !validYear || !validMonth || !validDay || !validName) {
    return null;
  }

  const validBlood = /^(A|B|AB|O)[+-]$/.test(bloodType);

  return {
    documentNumber,
    firstName,
    middleName: middleName || undefined,
    lastName,
    secondLastName: secondLastName || undefined,
    gender: gender as 'M' | 'F',
    birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
    bloodType: validBlood ? bloodType : undefined,
    raw,
  };
}
