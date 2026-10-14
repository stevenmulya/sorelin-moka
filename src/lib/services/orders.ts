import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { KANBAN_STATUSES, PAID_STATUSES, PAYMENT_METHODS, STATUS, type PaymentMethod } from '@/lib/constants';
import { UserError, cleanStr, isEmail, parseInteger, requireInteger } from '@/lib/validation';
import { effectivePrice } from '@/lib/utils';

export type Db = Prisma.TransactionClient;

export interface OrderLine {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  costPrice: number;
}

const MAX_LINES = 100;
const MAX_QTY = 999;

/**
 * Membangun item pesanan dari input klien. Klien hanya dipercaya untuk productId & quantity;
 * nama, harga (termasuk diskon), HPP, dan total SELALU diambil dari database.
 */
export async function buildOrder(
  rawItems: unknown,
  db: Db | typeof prisma = prisma,
): Promise<{ lines: OrderLine[]; total: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new UserError('Keranjang masih kosong.');
  if (rawItems.length > MAX_LINES) throw new UserError('Terlalu banyak item dalam satu pesanan.');

  const wanted = new Map<number, number>();
  for (const raw of rawItems) {
    const r = (raw ?? {}) as { productId?: unknown; quantity?: unknown };
    const productId = parseInteger(r.productId as number | string, { min: 1 });
    const quantity = parseInteger(r.quantity as number | string, { min: 1, max: MAX_QTY });
    if (productId === null || quantity === null) throw new UserError('Data item pesanan tidak valid.');
    wanted.set(productId, (wanted.get(productId) ?? 0) + quantity);
  }

  const products = await db.product.findMany({
    where: { id: { in: [...wanted.keys()] }, isActive: true },
    select: { id: true, name: true, price: true, discountPrice: true, costPrice: true, stock: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: OrderLine[] = [];
  let total = 0;
  for (const [productId, quantity] of wanted) {
    const p = byId.get(productId);
    if (!p) throw new UserError('Some products are no longer available. Please reload the page and try again.');
    if (quantity > p.stock) {
      throw new UserError(
        p.stock <= 0 ? `"${p.name}" is out of stock.` : `"${p.name}" only has ${p.stock} items remaining.`,
      );
    }
    const price = effectivePrice(p);
    lines.push({ productId, productName: p.name, quantity, price, costPrice: p.costPrice });
    total += price * quantity;
  }
  return { lines, total };
}

async function getOpenShift(db: Db) {
  return db.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
}

const PHONE_RE = /^[0-9+()\-\s]{6,20}$/;

export interface CreateOrderInput {
  customer: string;
  email?: string;
  phone?: string;
  items: unknown;
  selfieUrl?: string | null;
}

/** Membuat pesanan "Waiting Payment" pada shift yang sedang terbuka. */
export async function createOrder(input: CreateOrderInput) {
  const customer = cleanStr(input.customer, 60);
  if (!customer) throw new UserError('Customer name is required.');

  const email = cleanStr(input.email, 120);
  if (email && !isEmail(email)) throw new UserError('Invalid email format.');

  const phone = cleanStr(input.phone, 20);
  if (phone && !PHONE_RE.test(phone)) throw new UserError('Invalid phone number format.');

  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    if (!shift) throw new UserError('Store is closed (no active cashier shift opened).');

    const { lines, total } = await buildOrder(input.items, tx);

    return tx.transaction.create({
      data: {
        shiftId: shift.id,
        customer,
        customerEmail: email || null,
        customerPhone: phone || null,
        amount: total,
        status: STATUS.WAITING,
        selfieUrl: input.selfieUrl ?? null,
        items: { create: lines },
      },
    });
  });
}

function resolvePayment(method: string, paidRaw: unknown, amount: number): { method: PaymentMethod; paid: number } {
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw new UserError('Invalid payment method.');
  const m = method as PaymentMethod;
  if (m !== 'Cash') {
    // Non-tunai selalu pas sesuai total (tidak ada kembalian)
    return { method: m, paid: amount };
  }
  const paid = requireInteger(paidRaw as string | number, 'Payment amount', { min: amount, max: 2_000_000_000 });
  return { method: m, paid };
}

export interface ApproveInput {
  transactionId: number;
  cashierName: string;
  paymentMethod: string;
  paidAmount: unknown;
}

/**
 * Menyetujui pembayaran. Seluruh langkah (kunci status, potong stok, catat log) berada dalam
 * SATU transaksi database: jika salah satu gagal (mis. stok tidak cukup), semuanya dibatalkan.
 */
export async function approvePaymentService(input: ApproveInput) {
  const cashierName = cleanStr(input.cashierName, 60);
  if (!cashierName) throw new UserError('Cashier name is required.');

  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    if (!shift) throw new UserError('No active shift. Please open a shift first.');

    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId }, include: { items: true } });
    if (!trx) throw new UserError('Transaction not found.');
    if (trx.status !== STATUS.WAITING) throw new UserError('This transaction has already been processed.');
    if (trx.shiftId !== shift.id) throw new UserError('This transaction belongs to another shift and cannot be processed.');

    const { method, paid } = resolvePayment(input.paymentMethod, input.paidAmount, trx.amount);

    // Kunci atomik: hanya satu request yang berhasil mengubah Waiting Payment -> Preparing
    const lock = await tx.transaction.updateMany({
      where: { id: trx.id, status: STATUS.WAITING },
      data: {
        status: STATUS.PREPARING,
        preparedAt: new Date(),
        cashierName,
        paidAmount: paid,
        paymentMethod: method,
      },
    });
    if (lock.count === 0) throw new UserError('This transaction has already been processed.');

    for (const item of trx.items) {
      if (!item.productId) continue;
      const exists = await tx.product.findUnique({ where: { id: item.productId }, select: { id: true } });
      if (!exists) continue; // data lama: produk sudah dihapus permanen

      // Potong stok hanya jika cukup (guard di level SQL, tidak bisa minus)
      const dec = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (dec.count === 0) {
        throw new UserError(`Insufficient stock for "${item.productName}" to process this order.`);
      }
      await tx.inventoryLog.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          giver: null,
          receiver: trx.customer,
          notes: `Sales: TRX-${trx.id}`,
        },
      });
    }
    return { id: trx.id };
  });
}

export interface CancelInput {
  transactionId: number;
  reason: string;
}

/**
 * Membatalkan pesanan secara atomik.
 *  - Waiting Payment            : tidak ada stok yang perlu dikembalikan
 *  - Preparing / Ready          : stok dikembalikan
 *  - Picked Up / Closed         : dibatalkan (refund) tanpa mengembalikan stok (barang sudah diterima)
 * Pesanan dari shift yang sudah ditutup tidak boleh dibatalkan (menjaga rekonsiliasi kas).
 */
export async function cancelOrderService(input: CancelInput) {
  const reason = cleanStr(input.reason, 200);
  if (!reason) throw new UserError('Cancellation reason is required.');

  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId }, include: { items: true } });
    if (!trx) throw new UserError('Transaction not found.');
    if (trx.status === STATUS.CANCELLED) throw new UserError('Transaction is already cancelled.');

    if (trx.status !== STATUS.WAITING) {
      const shift = trx.shiftId ? await tx.shift.findUnique({ where: { id: trx.shiftId } }) : null;
      if (!shift || shift.status !== 'Open') {
        throw new UserError('Transactions from closed shifts cannot be cancelled.');
      }
    }

    const lock = await tx.transaction.updateMany({
      where: { id: trx.id, status: trx.status },
      data: { status: STATUS.CANCELLED, cancelReason: reason },
    });
    if (lock.count === 0) throw new UserError('Transaction status has changed. Please refresh the page.');

    if (trx.status === STATUS.PREPARING || trx.status === STATUS.READY) {
      for (const item of trx.items) {
        if (!item.productId) continue;
        const exists = await tx.product.findUnique({ where: { id: item.productId }, select: { id: true } });
        if (!exists) continue;
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            giver: 'Order Cancellation',
            receiver: null,
            notes: `Cancelled order: TRX-${trx.id} (${reason})`,
          },
        });
      }
    }
    return { id: trx.id };
  });
}

export interface EditPaymentInput {
  transactionId: number;
  paymentMethod: string;
  paidAmount: unknown;
}

/** Mengubah metode/nominal bayar. Hanya untuk pesanan terbayar pada shift yang masih terbuka. */
export async function editPaymentService(input: EditPaymentInput) {
  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    const trx = await tx.transaction.findUnique({ where: { id: input.transactionId } });
    if (!trx) throw new UserError('Transaction not found.');
    if (!PAID_STATUSES.includes(trx.status)) throw new UserError('Only paid orders can be modified.');
    if (!shift || trx.shiftId !== shift.id) {
      throw new UserError('Payments from closed shifts cannot be modified.');
    }
    const { method, paid } = resolvePayment(input.paymentMethod, input.paidAmount, trx.amount);
    await tx.transaction.update({ where: { id: trx.id }, data: { paymentMethod: method, paidAmount: paid } });
    return { id: trx.id };
  });
}

/** Perpindahan status yang sah di papan dapur. Pembatalan TIDAK boleh lewat sini. */
export function isAllowedTransition(from: string, to: string): boolean {
  if (from === to) return false;
  if (KANBAN_STATUSES.includes(from) && KANBAN_STATUSES.includes(to)) return true;
  return from === STATUS.PICKED_UP && to === STATUS.CLOSED;
}

export async function changeStatusService(transactionId: number, to: string) {
  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!trx) throw new UserError('Transaction not found.');
    if (!isAllowedTransition(trx.status, to)) throw new UserError('Status transition is not allowed.');

    const now = new Date();
    const data: Prisma.TransactionUpdateManyMutationInput = { status: to };
    if (to === STATUS.PREPARING) {
      data.readyAt = null;
      data.pickedUpAt = null;
    } else if (to === STATUS.READY) {
      data.readyAt = now;
      data.pickedUpAt = null;
    } else if (to === STATUS.PICKED_UP) {
      data.pickedUpAt = now;
      if (!trx.readyAt) data.readyAt = now;
    }

    const lock = await tx.transaction.updateMany({ where: { id: trx.id, status: trx.status }, data });
    if (lock.count === 0) throw new UserError('Order status has changed. Please refresh the page.');
    return { id: trx.id };
  });
}

/** Arsipkan (Picked Up -> Closed). Hanya pesanan yang benar-benar Picked Up yang terpengaruh. */
export async function archivePickedUpService(ids: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return { count: 0 };
  const clean = ids.map((i) => parseInteger(i as number | string, { min: 1 })).filter((i): i is number => i !== null);
  if (clean.length === 0) return { count: 0 };
  return prisma.transaction.updateMany({
    where: { id: { in: clean }, status: STATUS.PICKED_UP },
    data: { status: STATUS.CLOSED },
  });
}
