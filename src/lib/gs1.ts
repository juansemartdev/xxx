// Parser del texto GS1 en formato HRI (Human Readable Interpretation) que
// entrega zxing-wasm por defecto al leer un DataMatrix GS1: una secuencia
// de "(AI)valor" pegados, por ejemplo:
//   (01)00312345678907(17)260930(10)LOTE123(21)SN0001
//
// Cubre los identificadores de aplicación (AI) más comunes en
// trazabilidad de medicamentos:
//   01 -> GTIN
//   17 -> Fecha de vencimiento, YYMMDD
//   10 -> Número de lote
//   21 -> Número de serie
// No es un parser GS1 completo (no traduce todos los AIs existentes),
// pero cubre lo que trae un DataMatrix de vial típico. Si el código no es
// GS1 (no aparece ningún "(NN)"), el resultado queda vacío salvo "raw".

export type GS1Data = {
  gtin?: string;
  lot?: string;
  expiry?: string; // ISO yyyy-mm-dd (o yyyy-mm si el día viene como "00")
  serial?: string;
  raw: string;
};

const AI_SEGMENT = /\((\d{2,4})\)([^(]*)/g;

export function parseGS1(hri: string): GS1Data {
  const result: GS1Data = {raw: hri};
  const re = new RegExp(AI_SEGMENT);
  let m: RegExpExecArray | null;
  while ((m = re.exec(hri))) {
    const ai = m[1];
    const value = m[2];
    if (ai === '01') result.gtin = value;
    else if (ai === '17') result.expiry = yymmddToIso(value);
    else if (ai === '10') result.lot = value;
    else if (ai === '21') result.serial = value;
  }
  return result;
}

function yymmddToIso(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  // GS1: día "00" en AI 17 significa "último día del mes". Lo dejamos
  // como año-mes en ese caso, sin inventar un día.
  const dd = yymmdd.slice(4, 6);
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (dd === '00') return `${year}-${mm}`;
  return `${year}-${mm}-${dd}`;
}
