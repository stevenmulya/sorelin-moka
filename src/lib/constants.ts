/** Status transaksi. Disimpan sebagai String di DB, jadi selalu pakai konstanta ini (hindari salah ketik). */
export const STATUS = {
  WAITING: 'Waiting Payment',
  PREPARING: 'Preparing',
  READY: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
} as const;

/** Status yang sudah dibayar dan dihitung sebagai pendapatan. */
export const PAID_STATUSES: string[] = [
  STATUS.PREPARING,
  STATUS.READY,
  STATUS.PICKED_UP,
  STATUS.CLOSED,
];

/** Status yang tampil di papan Kanban dapur. */
export const KANBAN_STATUSES: string[] = [STATUS.PREPARING, STATUS.READY, STATUS.PICKED_UP];

export const PAYMENT_METHODS = ['Cash', 'QRIS', 'Debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Stok < ambang ini dianggap "rendah" (dipakai dashboard & halaman inventori). */
export const LOW_STOCK_THRESHOLD = 10;
/** Stok <= ambang ini dianggap kritis (merah). */
export const CRITICAL_STOCK_THRESHOLD = 5;

/** Zona waktu bisnis: WIB (UTC+7, tanpa DST). */
export const BUSINESS_UTC_OFFSET_HOURS = 7;
