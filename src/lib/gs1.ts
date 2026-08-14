// Parser de contenido GS1 leído de un DataMatrix. Intenta dos formatos,
// porque no todos los lectores/impresoras marcan el contenido igual:
//
// 1) HRI (Human Readable Interpretation): el formato que entrega
//    zxing-wasm por defecto cuando reconoce el símbolo como GS1 — una
//    secuencia de "(AI)valor" pegados, por ejemplo:
//      (01)00312345678907(17)260930(10)LOTE123(21)SN0001
//
// 2) "Plano": el element string GS1 crudo, sin paréntesis, con los
//    campos de longitud variable terminados en el separador de campo GS
//    (ASCII 29). Esto es lo que se obtiene si el escáner no reconoce el
//    símbolo como GS1 pero el contenido igual sigue esa estructura:
//      01003123456789071726093010LOTE123<GS>21SN0001
//
// Ambos cubren los identificadores de aplicación (AI) más comunes en
// trazabilidad de medicamentos: 01 (GTIN), 17 (vencimiento), 10 (lote),
// 21 (serie). No es un parser GS1 completo (no traduce todos los AIs
// existentes), pero cubre lo que trae un DataMatrix de vial típico.

export type GS1Data = {
  gtin?: string;
  lot?: string;
  expiry?: string; // ISO yyyy-mm-dd (o yyyy-mm si el día viene como "00")
  serial?: string;
  raw: string;
};

function hasAnyField(d: GS1Data): boolean {
  return Boolean(d.gtin || d.lot || d.expiry || d.serial);
}

export function parseGS1(raw: string): GS1Data {
  const hri = parseGS1Hri(raw);
  if (hasAnyField(hri)) return hri;

  const plain = parseGS1Plain(raw);
  if (hasAnyField(plain)) return plain;

  return {raw};
}

// --- Formato 1: HRI, "(AI)valor(AI)valor..." ---
function parseGS1Hri(raw: string): GS1Data {
  const result: GS1Data = {raw};
  const re = /\((\d{2,4})\)([^(]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const ai = m[1];
    const value = m[2];
    if (ai === '01') result.gtin = value;
    else if (ai === '17') result.expiry = yymmddToIso(value);
    else if (ai === '10') result.lot = value;
    else if (ai === '21') result.serial = value;
  }
  return result;
}

// --- Formato 2: element string GS1 crudo, sin paréntesis ---
const GS = String.fromCharCode(29); // separador de campo GS1 (ASCII 29)

function parseGS1Plain(rawInput: string): GS1Data {
  // Algunos lectores anteponen el identificador de simbología (]d2 para
  // DataMatrix GS1); lo quitamos si está presente.
  const s = rawInput.replace(/^\]d2/, '');
  const result: GS1Data = {raw: rawInput};
  let i = 0;

  while (i < s.length) {
    const ai = s.slice(i, i + 2);

    if (ai === '01' && s.length - i >= 16 && /^\d{14}$/.test(s.slice(i + 2, i + 16))) {
      result.gtin = s.slice(i + 2, i + 16);
      i += 16;
    } else if (ai === '17' && s.length - i >= 8 && /^\d{6}$/.test(s.slice(i + 2, i + 8))) {
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
      // AI no reconocido: saltamos hasta el siguiente separador GS. Si
      // no hay separador, no podemos seguir interpretando con
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
  // GS1: día "00" en AI 17 significa "último día del mes". Lo dejamos
  // como año-mes en ese caso, sin inventar un día.
  const dd = yymmdd.slice(4, 6);
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  if (dd === '00') return `${year}-${mm}`;
  return `${year}-${mm}-${dd}`;
}
