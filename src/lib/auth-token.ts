/**
 * Token sesi bertanda tangan (HMAC-SHA256) berbasis Web Crypto.
 * Aman dipakai di proxy.ts maupun di server action / route handler.
 *
 * Format token: base64url(payload).base64url(signature)
 * payload = JSON { r: role, e: expiryEpochSeconds }
 */

export type Role = 'admin' | 'kiosk';

export const SESSION_COOKIE = 'sorelin_session';

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

async function hmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );
}

export async function createSessionToken(role: Role, maxAgeSeconds: number): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error('AUTH_SECRET belum diset (minimal 32 karakter).');

  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ r: role, e: Math.floor(Date.now() / 1000) + maxAgeSeconds })),
  );
  const key = await hmacKey(secret, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${payload}.${toBase64Url(sig)}`;
}

/** Mengembalikan role jika token valid & belum kedaluwarsa, selain itu null. */
export async function verifySessionToken(token: string | undefined | null): Promise<Role | null> {
  if (!token) return null;
  const secret = getAuthSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return null;

  const key = await hmacKey(secret, ['verify']);
  // crypto.subtle.verify membandingkan secara constant-time
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as BufferSource,
    encoder.encode(payload),
  );
  if (!ok) return null;

  const raw = fromBase64Url(payload);
  if (!raw) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(raw)) as { r?: string; e?: number };
    if (typeof data.e !== 'number' || data.e < Math.floor(Date.now() / 1000)) return null;
    if (data.r === 'admin' || data.r === 'kiosk') return data.r;
    return null;
  } catch {
    return null;
  }
}
