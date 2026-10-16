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
  admin: 60 * 60 * 12, // 12 hours (one full operating day)
  kiosk: 60 * 60 * 24 * 7, // 7 days for active kiosk terminals
};

/** Constant-time string comparison via SHA-256 digest to prevent timing side-channels. */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ---- In-memory login rate limiter (scoped by client IP + username) ----
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 5 * 60 * 1000;
const attempts = new Map<string, { fails: number; first: number; lockedUntil: number }>();

async function clientKey(username: string): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || h.get('x-real-ip') || 'lan';
  return `${ip}:${username.trim().toLowerCase()}`;
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

/** Validate credentials against environment configuration and set a signed session cookie. */
export async function authenticate(username: string, password: string): Promise<LoginResult> {
  if (!getAuthSecret()) {
    console.error('[auth] AUTH_SECRET is not configured or is shorter than 32 characters. Login disabled.');
    return { success: false, error: 'Server authentication is not configured (AUTH_SECRET).' };
  }

  const key = await clientKey(username);
  const lockMs = checkLock(key);
  if (lockMs > 0) {
    const minutes = Math.ceil(lockMs / 60000);
    return {
      success: false,
      error: `Too many failed login attempts. Please try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
    };
  }

  const candidates: { role: Role; user?: string; pass?: string }[] = [
    {
      role: 'admin',
      user: process.env.ADMIN_USERNAME || 'admin',
      pass: process.env.ADMIN_PASSWORD || 'sorelin',
    },
    {
      role: 'kiosk',
      user: process.env.KIOSK_USERNAME || 'customer',
      pass: process.env.KIOSK_PASSWORD || 'soretan',
    },
  ];

  let matched: Role | null = null;
  for (const c of candidates) {
    if (!c.user || !c.pass) continue;
    // Always evaluate both without short-circuiting to keep response time uniform
    const userOk = safeEqual(username, c.user);
    const passOk = safeEqual(password, c.pass);
    if (userOk && passOk && matched === null) matched = c.role;
  }

  if (!matched) {
    registerFail(key);
    return { success: false, error: 'Invalid username or password.' };
  }

  attempts.delete(key);
  const token = await createSessionToken(matched, SESSION_MAX_AGE[matched]);
  (await cookies()).set(SESSION_COOKIE, token, {
    path: '/',
    maxAge: SESSION_MAX_AGE[matched],
    httpOnly: true,
    secure:
      process.env.COOKIE_SECURE === 'true' ||
      process.env.VERCEL === '1' ||
      process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return { success: true, role: matched };
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Return the active session role, or null if unauthenticated or expired. */
export async function getSessionRole(): Promise<Role | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Require an active admin session. Called at the start of every admin server action and route handler. */
export async function requireAdmin(): Promise<void> {
  const role = await getSessionRole();
  if (role !== 'admin') redirect('/login');
}

/** Require an active admin or kiosk session. */
export async function requireAnyRole(): Promise<Role> {
  const role = await getSessionRole();
  if (!role) redirect('/login');
  return role;
}
