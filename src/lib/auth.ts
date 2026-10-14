import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  SESSION_COOKIE,
  createSessionToken,
  getAuthSecret,
  verifySessionToken,
  type Role,
} from '@/lib/auth-token';

const SESSION_MAX_AGE: Record<Role, number> = {
  admin: 60 * 60 * 12, // 12 jam (cukup untuk satu hari operasional)
  kiosk: 60 * 60 * 24 * 7, // perangkat kiosk dibiarkan menyala
};

/** Bandingkan dua string tanpa membocorkan panjang/isi lewat waktu respon. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---- Pembatas percobaan login (in-memory; cukup untuk satu server di LAN) ----
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map<string, { fails: number; first: number; lockedUntil: number }>();

async function clientKey(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return fwd || h.get('x-real-ip') || 'lan';
}

function checkLock(key: string): number {
  const rec = attempts.get(key);
  if (!rec) return 0;
  const now = Date.now();
  if (rec.lockedUntil > now) return rec.lockedUntil - now;
  if (now - rec.first > WINDOW_MS) attempts.delete(key);
  return 0;
}

function registerFail(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { fails: 1, first: now, lockedUntil: 0 });
    return;
  }
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) rec.lockedUntil = now + LOCK_MS;
}

export type LoginResult =
  | { success: true; role: Role }
  | { success: false; error: string };

/** Validasi kredensial dari env, lalu pasang cookie sesi bertanda tangan. */
export async function authenticate(username: string, password: string): Promise<LoginResult> {
  if (!getAuthSecret()) {
    console.error('[auth] AUTH_SECRET belum diset / kurang dari 32 karakter. Login dinonaktifkan.');
    return { success: false, error: 'Server belum dikonfigurasi (AUTH_SECRET).' };
  }

  const key = await clientKey();
  const lockMs = checkLock(key);
  if (lockMs > 0) {
    return {
      success: false,
      error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(lockMs / 60000)} menit.`,
    };
  }

  const candidates: { role: Role; user?: string; pass?: string }[] = [
    { role: 'admin', user: process.env.ADMIN_USERNAME, pass: process.env.ADMIN_PASSWORD },
    { role: 'kiosk', user: process.env.KIOSK_USERNAME, pass: process.env.KIOSK_PASSWORD },
  ];

  let matched: Role | null = null;
  for (const c of candidates) {
    if (!c.user || !c.pass) continue;
    // Selalu hitung keduanya (tanpa short-circuit) agar waktu respon seragam
    const userOk = safeEqual(username, c.user);
    const passOk = safeEqual(password, c.pass);
    if (userOk && passOk && matched === null) matched = c.role;
  }

  if (!matched) {
    registerFail(key);
    return { success: false, error: 'Username atau password salah.' };
  }

  attempts.delete(key);
  const token = await createSessionToken(matched, SESSION_MAX_AGE[matched]);
  (await cookies()).set(SESSION_COOKIE, token, {
    path: '/',
    maxAge: SESSION_MAX_AGE[matched],
    httpOnly: true,
    // LAN biasanya HTTP biasa. Set COOKIE_SECURE=true hanya bila diakses lewat HTTPS.
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
  });
  return { success: true, role: matched };
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Role sesi saat ini (null jika belum login / token tidak valid / kedaluwarsa). */
export async function getSessionRole(): Promise<Role | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Wajib admin. Dipanggil di awal SETIAP server action admin & route handler admin. */
export async function requireAdmin(): Promise<void> {
  const role = await getSessionRole();
  if (role !== 'admin') redirect('/login');
}

/** Admin atau kiosk (untuk aksi yang memang boleh dipakai kiosk, mis. kirim pesanan). */
export async function requireAnyRole(): Promise<Role> {
  const role = await getSessionRole();
  if (!role) redirect('/login');
  return role;
}
