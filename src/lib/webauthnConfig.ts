import {NextRequest} from 'next/server';

export const RP_NAME = 'ChainDose';

// Deriva el RP ID (dominio) y el origin esperado a partir de la propia
// solicitud, en vez de hardcodear un dominio. Así funciona igual en
// localhost, en preview deployments de Vercel y en producción, sin tocar
// código al cambiar de dominio.
export function getRpInfo(req: NextRequest) {
  return {
    rpID: req.nextUrl.hostname,
    origin: req.nextUrl.origin,
  };
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  // Allocate a fresh, plain ArrayBuffer-backed Uint8Array (not
  // ArrayBufferLike/SharedArrayBuffer) by size, then copy in — this is the
  // form TypeScript infers as Uint8Array<ArrayBuffer>, matching
  // @simplewebauthn/server's Uint8Array_ type for WebAuthnCredential.publicKey.
  const buf = Buffer.from(s, 'base64url');
  const out = new Uint8Array(buf.byteLength);
  out.set(buf);
  return out;
}
