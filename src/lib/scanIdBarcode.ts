// Escaneo del código de barras PDF417 del reverso de la cédula
// colombiana (formato amarillo/laminado). La cédula digital (azul) trae
// un código QR en vez de PDF417, pero ese QR está cifrado por la
// Registraduría como medida de seguridad — no es legible por apps de
// terceros, así que no intentamos decodificarlo aquí. Para la cédula
// digital, la única vía es OCR del texto impreso (ver readCedula.ts).

export async function scanPdf417(imageDataUrl: string): Promise<{text: string; bytesLatin1: string} | null> {
  const {readBarcodes} = await import('zxing-wasm/reader');
  const blob = await fetch(imageDataUrl).then((r) => r.blob());

  const results = await readBarcodes(blob, {
    tryHarder: true,
    formats: ['PDF417'],
    maxNumberOfSymbols: 1,
  });

  const result = results[0];
  if (!result) return null;

  let bytesLatin1 = '';
  for (let i = 0; i < result.bytes.length; i++) bytesLatin1 += String.fromCharCode(result.bytes[i]);

  return {text: result.text, bytesLatin1};
}
