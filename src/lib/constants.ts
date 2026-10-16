/** Transaction statuses stored in the database. Always reference this constant to prevent typos. */
export const STATUS = {
  WAITING: 'Waiting Payment',
  PREPARING: 'Preparing',
  READY: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
} as const;

/** Statuses that have been paid and count toward revenue. */
export const PAID_STATUSES: string[] = [
  STATUS.PREPARING,
  STATUS.READY,
  STATUS.PICKED_UP,
  STATUS.CLOSED,
];

/** Statuses displayed on the active kitchen Kanban board. */
export const KANBAN_STATUSES: string[] = [STATUS.PREPARING, STATUS.READY, STATUS.PICKED_UP];

export const PAYMENT_METHODS = ['Cash', 'QRIS', 'Debit'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Stock below this threshold is flagged as low stock across Dashboard and Inventory. */
export const LOW_STOCK_THRESHOLD = 10;

/** Maximum waiting payment orders fetched on the dashboard widget. */
export const MAX_WAITING_ORDERS = 50;

/** Business timezone offset: WIB (UTC+7, no DST). */
export const BUSINESS_UTC_OFFSET_HOURS = 7;
