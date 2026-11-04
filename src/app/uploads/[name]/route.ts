import { promises as fs } from 'node:fs';
import { getSessionRole } from '@/lib/auth';
import { contentTypeFor, resolveUploadPath } from '@/lib/uploads';

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Serves uploaded files exclusively to authenticated users:
 *  - Product images (`prod_*`): admin or kiosk
 *  - Customer selfies (`selfie_*`): admin only (customer privacy)
 */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const role = await getSessionRole();
  if (!role) return new Response('Unauthorized', { status: 401 });
  if (name.startsWith('selfie_') && role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  const full = resolveUploadPath(name);
  if (!full) return new Response('Not found', { status: 404 });

  try {
    const data = await fs.readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': contentTypeFor(name),
        'Content-Length': String(data.length),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        // Unique filenames (UUID/timestamp) are safe to cache privately in the browser
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
