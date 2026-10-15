import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UserError } from '@/lib/validation';

/**
 * File upload disimpan DI LUAR folder `public/` supaya tidak bisa diakses tanpa login.
 * Disajikan lewat route handler `/uploads/[name]` yang memeriksa sesi.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), 'uploads');

export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB per gambar
export const MAX_PRODUCT_IMAGES_PER_REQUEST = 4;
export const MAX_SELFIE_BYTES = 2 * 1024 * 1024; // 2 MB (setelah decode)

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/;

type Detected = { ext: 'jpg' | 'png' | 'gif' | 'webp'; mime: string };

/** Deteksi tipe gambar dari isi file (magic bytes), bukan dari nama / header klien. */
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

/** Path absolut file upload, atau null jika nama tidak aman / keluar dari UPLOAD_DIR. */
export function resolveUploadPath(name: string): string | null {
  if (!isSafeUploadName(name)) return null;
  const full = path.join(UPLOAD_DIR, name);
  if (path.dirname(full) !== UPLOAD_DIR) return null;
  return full;
}

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function writeUnique(prefix: string, ext: string, buf: Buffer): Promise<string> {
  await ensureDir();
  const name = `${prefix}${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), buf, { flag: 'wx' });
  return `/uploads/${name}`;
}

/** Simpan gambar produk (divalidasi ukuran & isi). Mengembalikan URL publik internal. */
export async function saveProductImage(file: File): Promise<string> {
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new UserError(`Gambar "${file.name.slice(0, 40)}" melebihi 3 MB.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buf);
  if (!kind) throw new UserError(`File "${file.name.slice(0, 40)}" bukan gambar yang didukung (JPG/PNG/WebP/GIF).`);
  return writeUnique('', kind.ext, buf);
}

/** Simpan selfie dari data URL (png/jpeg). Awalan `selfie_` dipakai untuk pembatasan akses admin. */
export async function saveSelfieDataUrl(dataUrl: string): Promise<string> {
  const clean = (dataUrl || '').trim();
  const m = /^data:image\/(png|jpe?g);base64,\s*([A-Za-z0-9+/=\r\n\s]+)$/.exec(clean);
  if (!m) throw new UserError('Format foto tidak valid.');
  const base64Data = m[2].replace(/\s+/g, '');
  const buf = Buffer.from(base64Data, 'base64');
  if (buf.length === 0 || buf.length > MAX_SELFIE_BYTES) throw new UserError('Ukuran foto tidak valid (maks 2 MB).');
  const kind = detectImage(buf);
  if (!kind || (kind.ext !== 'png' && kind.ext !== 'jpg')) throw new UserError('Foto bukan gambar PNG/JPEG yang valid.');
  return writeUnique('selfie_', kind.ext, buf);
}

/** Hapus file berdasarkan URL `/uploads/<nama>` yang tersimpan di DB. Aman terhadap input aneh. */
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
