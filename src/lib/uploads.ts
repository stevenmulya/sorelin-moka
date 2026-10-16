import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UserError } from '@/lib/validation';

/**
 * Uploaded files stored on local disk are kept outside `public/` and served via
 * the authenticated `/uploads/[name]` route handler. When running with Turso Cloud
 * or on serverless environments (e.g., Vercel read-only filesystem), validated
 * images are stored as canonical Data URLs so they work reliably across all devices.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'uploads');

export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB per image
export const MAX_PRODUCT_IMAGES_PER_REQUEST = 4;
export const MAX_SELFIE_BYTES = 2 * 1024 * 1024; // 2 MB after base64 decode

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/;

type Detected = { ext: 'jpg' | 'png' | 'gif' | 'webp'; mime: string };

/** Detect image type from magic bytes rather than trusting client filename or headers. */
export function detectImage(buf: Buffer): Detected | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length >= 6 && buf.subarray(0, 4).toString('ascii') === 'GIF8') {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function contentTypeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export function isSafeUploadName(name: string): boolean {
  return SAFE_NAME.test(name) && !name.includes('..');
}

/** Absolute path to an uploaded file, or null if the filename is unsafe. */
export function resolveUploadPath(name: string): string | null {
  if (!isSafeUploadName(name)) return null;
  const full = path.join(UPLOAD_DIR, name);
  if (path.dirname(full) !== UPLOAD_DIR) return null;
  return full;
}

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function writeUniqueOrDataUrl(prefix: string, kind: Detected, buf: Buffer): Promise<string> {
  // For customer selfies, or when using Turso Cloud DB / running on Vercel serverless,
  // store validated images as canonical Data URLs so they are instantly accessible across all devices.
  if (prefix === 'selfie_' || process.env.VERCEL || process.env.TURSO_DATABASE_URL) {
    return `data:${kind.mime};base64,${buf.toString('base64')}`;
  }
  try {
    await ensureDir();
    const name = `${prefix}${randomUUID()}.${kind.ext}`;
    await fs.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), buf, { flag: 'wx' });
    return `/uploads/${name}`;
  } catch {
    return `data:${kind.mime};base64,${buf.toString('base64')}`;
  }
}

/** Validate and save a product image. Returns an internal URL or validated Data URL. */
export async function saveProductImage(file: File): Promise<string> {
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new UserError(`Image "${file.name.slice(0, 40)}" exceeds the 3 MB size limit.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buf);
  if (!kind) {
    throw new UserError(`File "${file.name.slice(0, 40)}" is not a supported image format (JPG, PNG, WebP, or GIF).`);
  }
  return writeUniqueOrDataUrl('', kind, buf);
}

/** Validate and save a customer selfie from a base64 Data URL. */
export async function saveSelfieDataUrl(dataUrl: string): Promise<string> {
  const clean = (dataUrl || '').trim();
  const m = /^data:image\/(png|jpe?g|webp)(?:;[^;]+)*;base64,\s*([A-Za-z0-9+/=\r\n\s]+)$/i.exec(clean);
  if (!m) throw new UserError('Invalid photo format. Please retake the photo or skip.');
  const base64Data = m[2].replace(/\s+/g, '');
  const buf = Buffer.from(base64Data, 'base64');
  if (buf.length === 0 || buf.length > MAX_SELFIE_BYTES) {
    throw new UserError('Photo size is invalid (maximum 2 MB).');
  }
  const kind = detectImage(buf);
  if (!kind || (kind.ext !== 'png' && kind.ext !== 'jpg' && kind.ext !== 'webp')) {
    throw new UserError('Photo must be a valid PNG, JPEG, or WebP image.');
  }
  return writeUniqueOrDataUrl('selfie_', kind, buf);
}

/** Delete a local upload file by its `/uploads/<name>` URL. Safely ignores Data URLs. */
export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith('/uploads/')) return;
  const full = resolveUploadPath(url.slice('/uploads/'.length));
  if (!full) return;
  try {
    await fs.unlink(full);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('Failed to delete upload file', e);
  }
}
