import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-token';

/**
 * Gerbang akses utama (lapisan pertama). Lapisan kedua: setiap server action &
 * route handler tetap memanggil requireAdmin()/requireAnyRole() sendiri.
 *
 * Aturan:
 *  - /login                : publik
 *  - /kiosk, /uploads      : role kiosk atau admin
 *  - semua lainnya (+/api) : hanya admin
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/sorelin-') ||
    pathname === '/manifest.json' ||
    pathname === '/icon.svg' ||
    pathname === '/placeholder.jpg' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const role = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname === '/api' || pathname.startsWith('/api/');

  if (!role) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const kioskAllowed =
    pathname === '/kiosk' ||
    pathname.startsWith('/kiosk/') ||
    pathname.startsWith('/uploads/');

  if (role === 'kiosk' && !kioskAllowed) {
    if (isApi) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/kiosk';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Aset statis build & file publik non-sensitif dikecualikan. Selain itu SEMUA path lewat proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg|placeholder.jpg|sorelin-.*\\.png|icons/.*).*)'],
};
