import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatWibDate } from '@/lib/dates';

/** Gabungkan class Tailwind secara dinamis dan aman dari konflik class. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format angka menjadi format Rupiah terpusat (contoh: Rp 15.000). */
export function formatRupiah(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/** Format tanggal TRX memakai WIB agar identik di server maupun browser. */
export function generateTrxCode(id: number, date: Date | string, customer?: string | null) {
  const d = new Date(date);
  const [y, m, day] = formatWibDate(d).split('-');
  const dateStr = `${day}${m}${y}`;

  // Nama pelanggan: huruf kapital, tanpa karakter khusus, maksimal 6 huruf dari kata pertama
  const safeCustomer = (customer || 'GUEST').trim();
  const cleanCustomer = safeCustomer.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6) || 'GUEST';

  return `TRX-${id.toString().padStart(4, '0')}-${dateStr}-${cleanCustomer}`;
}

/** Harga jual efektif: harga diskon bila ada & valid, selain itu harga normal. */
export function effectivePrice(p: { price: number; discountPrice?: number | null }): number {
  if (p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price) return p.discountPrice;
  return p.price;
}
