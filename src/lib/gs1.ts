// Parser mínimo de "element strings" GS1 (el contenido que trae el
// DataMatrix de un vial farmacéutico). Cubre los identificadores de
// aplicación (AI) más comunes en trazabilidad de medicamentos:
//   01 -> GTIN (14 dígitos, longitud fija)
//   17 -> Fecha de vencimiento, YYMMDD (longitud fija)
//   10 -> Número de lote (longitud variable, termina en GS o fin de cadena)
//   21 -> Número de serie (longitud variable, termina en GS o fin de cadena)
// No es un parser GS1 completo (no cubre todos los AIs existentes), pero
// es suficiente para lo que trae un DataMatrix de vial típico.

export type GS1Data = {
  gtin?: string;
  lot?: string;
  expiry?: string; // ISO yyyy-mm-dd
  serial?: string;
  raw: string;
};

const GS = String.fromCharCode(29); // separador de campo GS1 (ASCII 29)

export function parseGS1(rawInput: string): GS1Data {
  // Algunos lectores anteponen el identificador de simbología (]d2 para
  // DataMatrix GS1); lo quitamos si está presente.
  const s = rawInput.replace(/^\]d2/, '');
  const result: GS1Data = {raw: rawInput};
  let i = 0;

  while (i < s.length) {
    const ai = s.slice(i, i + 2);

    if (ai === '01' && s.length - i >= 16) {
      result.gtin = s.slice(i + 2, i + 16);
      i += 16;
    } else if (ai === '17' && s.length - i >= 8) {
      result.expiry = yymmddToIso(s.slice(i + 2, i + 8));
      i += 8;
    } else if (ai === '10') {
      i += 2;
      const end = s.indexOf(GS, i);
      result.lot = end === -1 ? s.slice(i) : s.slice(i, end);
      i = end === -1 ? s.length : end + 1;
    } else if (ai === '21') {
      i += 2;
      const end = s.indexOf(GS, i);
      result.serial = end === -1 ? s.slice(i) : s.slice(i, end);
      i = end === -1 ? s.length : end + 1;
    } else {
      // AI no reconocido: saltamos hasta el siguiente separador GS.
      // Si no hay separador, no podemos seguir interpretando con
      // seguridad y nos detenemos.
      const end = s.indexOf(GS, i);
      if (end === -1) break;
      i = end + 1;
    }
  }

  return result;
}

function yymmddToIso(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  // GS1 día "00" en AI 17 significa "último día del mes" — lo dejamos
  // como 01 para tener una fecha válida y lo señalamos en el string ISO
  // solo con año-mes si el día es 00.
  const dd = yymmdd.slice(4, 6);
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (dd === '00') return `${year}-${mm}`;
  return `${year}-${mm}-${dd}`;
}
