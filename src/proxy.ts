import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-token';

/**
 * Primary access gateway (first layer). Second layer: every server action and
 * route handler still calls requireAdmin() or requireAnyRole() directly.
 *
 * Rules:
 *  - /login                : public
 *  - /kiosk, /uploads      : kiosk or admin role
 *  - all other routes      : admin only
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/icons/') ||
    pathname.toLowerCase().startsWith('/sorelin-') ||
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
    const callbackTarget = `${pathname}${request.nextUrl.search}`;
    url.pathname = '/login';
    url.search = '';
    if (callbackTarget !== '/') url.searchParams.set('callbackUrl', callbackTarget);
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
  // Static build assets and public non-sensitive files are excluded. All other paths pass through proxy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon.svg|placeholder.jpg|[sS][oO][rR][eE][lL][iI][nN]-.*\\.png|icons/.*).*)'],
};
