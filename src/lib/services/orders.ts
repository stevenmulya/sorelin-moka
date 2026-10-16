import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { KANBAN_STATUSES, PAID_STATUSES, PAYMENT_METHODS, STATUS, type PaymentMethod } from '@/lib/constants';
import { UserError, cleanStr, isEmail, parseInteger, requireInteger } from '@/lib/validation';
import { effectivePrice, formatRupiah } from '@/lib/utils';
import { summarizeShift } from '@/lib/services/shifts';

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
 * Build validated order line items from client input. Only productId and quantity
 * are accepted from the client; product name, effective price, cost price, and totals
 * are always resolved directly from the database.
 */
export async function buildOrder(
  rawItems: unknown,
  db: Db | typeof prisma = prisma,
): Promise<{ lines: OrderLine[]; total: number }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new UserError('Cart is empty.');
  if (rawItems.length > MAX_LINES) throw new UserError('Too many items in a single order.');

  const wanted = new Map<number, number>();
  for (const raw of rawItems) {
    const r = (raw ?? {}) as { productId?: unknown; quantity?: unknown };
    const productId = parseInteger(r.productId as number | string, { min: 1 });
    const quantity = parseInteger(r.quantity as number | string, { min: 1, max: MAX_QTY });
    if (productId === null || quantity === null) throw new UserError('Invalid order item data.');
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

/** Create a "Waiting Payment" order in the currently open shift. */
export async function createOrder(input: CreateOrderInput) {
  const customer = cleanStr(input.customer, 60);
  if (!customer) throw new UserError('Customer name is required.');

  const email = cleanStr(input.email, 120);
  if (email && !isEmail(email)) throw new UserError('Invalid email format.');

  const phone = cleanStr(input.phone, 20);
  if (phone && !PHONE_RE.test(phone)) throw new UserError('Invalid phone number format.');

  return prisma.$transaction(async (tx) => {
    const shift = await getOpenShift(tx);
    if (!shift) throw new UserError('Store is currently closed (no active cashier shift).');

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
    // Non-cash payments always match the exact order amount
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
 * Approve payment atomically: lock status, deduct stock, and record inventory logs
 * within a single database transaction.
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

    // Atomic lock: only one request can transition Waiting Payment -> Preparing
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

    const productIds = trx.items.map((i) => i.productId).filter((id): id is number => id !== null);
    const existingProducts = productIds.length > 0
      ? await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
      : [];
    const existingSet = new Set(existingProducts.map((p) => p.id));

    for (const item of trx.items) {
      if (!item.productId || !existingSet.has(item.productId)) continue;

      // Deduct stock only if sufficient (SQL-level guard prevents negative stock)
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
 * Cancel an order atomically:
 *  - Waiting Payment            : no stock to restore
 *  - Preparing / Ready          : stock is restored to inventory
 *  - Picked Up / Closed         : refunded/cancelled without restoring stock
 * Orders from closed shifts cannot be cancelled to preserve shift cash reconciliation.
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

      if (trx.paymentMethod === 'Cash') {
        const summary = await summarizeShift(tx, shift.id);
        const availableCash = shift.initialCash + summary.cashSales - summary.cashExpenses;
        if (trx.amount > availableCash) {
          throw new UserError(
            `Cannot refund ${formatRupiah(trx.amount)} in cash because cash expenses have already reduced the drawer balance to ${formatRupiah(Math.max(0, availableCash))}.`
          );
        }
      }
    }

    const lock = await tx.transaction.updateMany({
      where: { id: trx.id, status: trx.status },
      data: { status: STATUS.CANCELLED, cancelReason: reason },
    });
    if (lock.count === 0) throw new UserError('Transaction status has changed. Please refresh the page.');

    if (trx.status === STATUS.PREPARING || trx.status === STATUS.READY) {
      const productIds = trx.items.map((i) => i.productId).filter((id): id is number => id !== null);
      const existingProducts = productIds.length > 0
        ? await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
        : [];
      const existingSet = new Set(existingProducts.map((p) => p.id));

      for (const item of trx.items) {
        if (!item.productId || !existingSet.has(item.productId)) continue;
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

/** Modify payment method or paid amount for a paid order in the currently open shift. */
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

    if (trx.paymentMethod === 'Cash' && method !== 'Cash') {
      const summary = await summarizeShift(tx, shift.id);
      const availableCash = shift.initialCash + summary.cashSales - summary.cashExpenses;
      if (trx.amount > availableCash) {
        throw new UserError(
          `Cannot change payment method from Cash because cash expenses have already reduced the drawer balance to ${formatRupiah(Math.max(0, availableCash))}.`
        );
      }
    }

    await tx.transaction.update({ where: { id: trx.id }, data: { paymentMethod: method, paidAmount: paid } });
    return { id: trx.id };
  });
}

/** Valid status transitions on the kitchen Kanban board. Cancellations must use cancelOrderService. */
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

/** Archive Picked Up orders to Closed status. */
export async function archivePickedUpService(ids: unknown) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) return { count: 0 };
  const clean = ids.map((i) => parseInteger(i as number | string, { min: 1 })).filter((i): i is number => i !== null);
  if (clean.length === 0) return { count: 0 };
  return prisma.transaction.updateMany({
    where: { id: { in: clean }, status: STATUS.PICKED_UP },
    data: { status: STATUS.CLOSED },
  });
}
