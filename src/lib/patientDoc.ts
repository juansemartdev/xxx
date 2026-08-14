// Solo dígitos, para que "1.234.567" y "1234567" se traten como el mismo
// documento sin importar cómo lo haya escrito o leído el OCR/código de
// barras. Compartido entre /api/patients y /api/atenciones para que ambos
// busquen por el mismo criterio.
export function normalizeDocumentNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}
