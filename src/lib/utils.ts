import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatWibDate } from '@/lib/dates';

/** Merge Tailwind CSS classes safely without style conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Centralized Indonesian Rupiah currency formatter (e.g. Rp 15.000). */
export function formatRupiah(amount: number | null | undefined): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Rp 0';
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

/** Generate a standardized transaction code using WIB date so it matches on server and client. */
export function generateTrxCode(id: number, date: Date | string, customer?: string | null) {
  const d = new Date(date);
  const [y, m, day] = formatWibDate(d).split('-');
  const dateStr = `${day}${m}${y}`;

  // Customer code: uppercase alphanumeric, up to 6 characters from first name
  const safeCustomer = (customer || 'GUEST').trim();
  const cleanCustomer = safeCustomer.split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 6) || 'GUEST';

  return `TRX-${id.toString().padStart(4, '0')}-${dateStr}-${cleanCustomer}`;
}

/** Effective unit price: returns discountPrice when valid and lower than regular price. */
export function effectivePrice(p: { price: number; discountPrice?: number | null }): number {
  if (p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price) return p.discountPrice;
  return p.price;
}
