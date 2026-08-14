// Convierte una imagen en base64 (con o sin el prefijo "data:image/...;base64,")
// a bytes, para enviarla directo a Rekognition (Image.Bytes) sin pasar por S3.
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',', 2)[1] : dataUrl;
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function bytesToBase64(bytes: Uint8Array | undefined): string | null {
  if (!bytes) return null;
  return Buffer.from(bytes).toString('base64');
}
