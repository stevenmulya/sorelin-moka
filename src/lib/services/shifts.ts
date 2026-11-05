import { cache } from 'react';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PAID_STATUSES, STATUS } from '@/lib/constants';
import { UserError, cleanStr, requireInteger, parseInteger } from '@/lib/validation';
import type { Db } from '@/lib/services/orders';

let cachedShiftRecord: { data: import('@prisma/client').Shift | null; expiresAt: number } | null = null;
const SHIFT_CACHE_TTL_MS = 5000;

export function invalidateShiftCache() {
  cachedShiftRecord = null;
}

/**
 * Fast in-memory cached active shift lookup (5s TTL) so page navigation does not wait
 * on redundant network roundtrips to the remote database. Invalidated on open/close shift.
 */
export const getActiveShift = cache(async () => {
  const now = performance.now();
  if (cachedShiftRecord && cachedShiftRecord.expiresAt > now) {
    return cachedShiftRecord.data;
  }
  const shift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' },
  });
  cachedShiftRecord = { data: shift, expiresAt: now + SHIFT_CACHE_TTL_MS };
  return shift;
});

export interface ShiftSummary {
  revenue: number;
  cashSales: number;
  qrisSales: number;
  debitSales: number;
  cogs: number;
  paidOrders: number;
  pendingCount: number;
  activeKitchenCount: number; // Orders still in Preparing or Ready for Pickup
  expenses: number; // Total operational expenses
  cashExpenses: number; // Expenses recorded
  nonCashExpenses: number;
  netFlow: number; // Cash/financial flow: revenue - expenses (can be negative)
  netProfit: number; // Net profit: revenue - cogs - expenses (can be negative)
}

/**
 * Single source of truth for shift financial calculations across all pages.
 */
export async function summarizeShift(db: Db | typeof prisma, shiftId: number): Promise<ShiftSummary> {
  const [trxs, expAll, expCash] = await Promise.all([
    db.transaction.findMany({
      where: { shiftId, status: { in: [...PAID_STATUSES, STATUS.WAITING] } },
      select: { amount: true, status: true, paymentMethod: true, items: { select: { quantity: true, costPrice: true } } },
    }),
    db.expense.aggregate({ where: { shiftId }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { shiftId, paymentMethod: 'Cash' }, _sum: { amount: true } }),
  ]);

  const totalExp = expAll._sum.amount ?? 0;
  const cashExp = expCash._sum.amount ?? 0;
  const nonCashExp = Math.max(0, totalExp - cashExp);

  const s: ShiftSummary = {
    revenue: 0,
    cashSales: 0,
    qrisSales: 0,
    debitSales: 0,
    cogs: 0,
    paidOrders: 0,
    pendingCount: 0,
    activeKitchenCount: 0,
    expenses: totalExp,
    cashExpenses: cashExp,
    nonCashExpenses: nonCashExp,
    netFlow: 0,
    netProfit: 0,
  };

  for (const t of trxs) {
    if (t.status === STATUS.WAITING) {
      s.pendingCount++;
      continue;
    }
    if (t.status === STATUS.PREPARING || t.status === STATUS.READY) {
      s.activeKitchenCount++;
    }
    s.paidOrders++;
    s.revenue += t.amount;
    if (t.paymentMethod === 'QRIS') s.qrisSales += t.amount;
    else if (t.paymentMethod === 'Debit') s.debitSales += t.amount;
    else s.cashSales += t.amount;
    for (const i of t.items) s.cogs += i.quantity * i.costPrice;
  }

  s.netFlow = s.revenue - s.expenses;
  s.netProfit = s.revenue - s.cogs - s.expenses;

  return s;
}

export function expectedCashOf(initialCash: number, summary: ShiftSummary): number {
  return initialCash + summary.cashSales - summary.cashExpenses;
}

/** Open a shift. Enforces that only one shift can be Open at any time. Initial cash is optional (defaults to 0). */
export async function openShiftService(openedByRaw: string, initialCashRaw?: unknown) {
  const openedBy = cleanStr(openedByRaw, 60);
  if (!openedBy) throw new UserError('Cashier name is required.');
  const initialCash =
    initialCashRaw !== undefined && initialCashRaw !== null && String(initialCashRaw).trim() !== ''
      ? parseInteger(initialCashRaw as string | number, { min: 0, max: 2_000_000_000 }) ?? 0
      : 0;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.shift.findFirst({ where: { status: 'Open' } });
      if (existing) throw new UserError('There is already an active shift. Please close it first.');
      const created = await tx.shift.create({ data: { openedBy, initialCash, status: 'Open', activeKey: 1 } });
      invalidateShiftCache();
      return created;
    }, { maxWait: 15000, timeout: 30000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new UserError('There is already an active shift. Please close it first.');
    }
    throw e;
  }
}

/**
 * Close shift atomically:
 *  1) Cancel unpaid waiting orders
 *  2) Calculate expected cash from server records
 *  3) Lock shift as closed with expected and actual cash
 *  4) Archive active shift orders from the kitchen board
 */
export async function closeShiftService(shiftId: number, actualCashRaw: unknown, closedByRaw: string) {
  const closedBy = cleanStr(closedByRaw, 60);
  if (!closedBy) throw new UserError('Closed by name is required.');
  const actualCash =
    actualCashRaw !== undefined && actualCashRaw !== null && String(actualCashRaw).trim() !== ''
      ? parseInteger(actualCashRaw as string | number, { min: -2_000_000_000, max: 2_000_000_000 }) ?? 0
      : 0;

  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== 'Open') throw new UserError('This shift is already closed or does not exist.');

    await tx.transaction.updateMany({
      where: { shiftId, status: STATUS.WAITING },
      data: { status: STATUS.CANCELLED, cancelReason: 'Shift closed before payment was completed' },
    });

    const summary = await summarizeShift(tx, shiftId);
    const expectedCash = expectedCashOf(shift.initialCash, summary);

    const lock = await tx.shift.updateMany({
      where: { id: shiftId, status: 'Open' },
      data: { status: 'Closed', endTime: new Date(), activeKey: null, actualCash, expectedCash, closedBy },
    });
    if (lock.count === 0) throw new UserError('This shift is already closed.');

    // Clear kitchen board for next shift (archive paid orders belonging to this closed shift)
    await tx.transaction.updateMany({
      where: { shiftId, status: { in: [STATUS.PREPARING, STATUS.READY, STATUS.PICKED_UP] } },
      data: { status: STATUS.CLOSED },
    });

    invalidateShiftCache();

    // Automated Immutable Snapshot Backup upon shift closing (bulletproof disaster recovery)
    try {
      const fs = await import('fs');
      const path = await import('path');
      const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
      if (fs.existsSync(dbPath)) {
        const backupDir = path.resolve(process.cwd(), 'prisma', 'backups');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `bazaar-shift-${shiftId}-${stamp}.db`);
        fs.copyFileSync(dbPath, backupFile);
      }
    } catch {
      // Non-fatal if snapshot fails
    }

    return { expectedCash, actualCash };
  }, { maxWait: 15000, timeout: 30000 });
}

export async function createExpenseService(
  nameRaw: string,
  amountRaw: unknown,
  paymentMethodRaw?: string
) {
  const name = cleanStr(nameRaw, 100);
  if (!name) throw new UserError('Expense name is required.');
  const amount = requireInteger(amountRaw as string | number, 'Expense amount', { min: 1, max: 2_000_000_000 });

  const paymentMethod = paymentMethodRaw ? cleanStr(paymentMethodRaw, 30) || 'Cash' : 'Cash';

  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
    if (!shift) throw new UserError('Please open a shift before recording expenses.');

    // No cash drawer restrictions: expenses can exceed sales/cash freely (supports upfront rent, negative profit, etc.)
    const now = new Date();
    return tx.expense.create({
      data: { name, amount, paymentMethod, startDate: now, endDate: now, shiftId: shift.id },
    });
  }, { maxWait: 15000, timeout: 30000 });
}

/** Expenses can only be deleted while their shift is still open. */
export async function deleteExpenseService(id: number) {
  return prisma.$transaction(async (tx) => {
    const exp = await tx.expense.findUnique({ where: { id }, include: { shift: true } });
    if (!exp) throw new UserError('Expense not found.');
    if (!exp.shift || exp.shift.status !== 'Open') {
      throw new UserError('Expenses from closed shifts cannot be deleted.');
    }
    await tx.expense.delete({ where: { id } });
  }, { maxWait: 15000, timeout: 30000 });
}

export interface SelectiveResetOptions {
  transactions?: boolean;
  shifts?: boolean;
  stock?: boolean;
  products?: boolean;
  expenses?: boolean;
  inventoryLogs?: boolean;
  selfies?: boolean;
}

export interface ClearDataResult {
  deletedTransactions: number;
  deletedItems: number;
  deletedExpenses: number;
  deletedLogs: number;
  deletedShifts: number;
  zeroedProducts: number;
  zeroedVariants: number;
  deletedProducts?: number;
  deletedSelfies: number;
}

/**
 * Purge operational data with granular selective control.
 * By default (or when all selected), resets transactions, shifts, expenses,
 * inventory logs, selfies, and zeroes out physical stock levels.
 */
export async function clearAllTransactionsAndShiftsService(
  options?: SelectiveResetOptions
): Promise<ClearDataResult> {
  const opt: SelectiveResetOptions = options ?? {
    transactions: true,
    shifts: true,
    expenses: true,
    inventoryLogs: true,
    selfies: true,
    stock: true,
    products: false,
  };

  const result = await prisma.$transaction(
    async (tx) => {
      let deletedTransactions = 0;
      let deletedItems = 0;
      let deletedExpenses = 0;
      let deletedLogs = 0;
      let deletedShifts = 0;
      let zeroedProducts = 0;
      let zeroedVariants = 0;
      let deletedProducts = 0;

      // 1. Transactions & Items
      if (opt.transactions) {
        const delItems = await tx.transactionItem.deleteMany({});
        const delTx = await tx.transaction.deleteMany({});
        deletedItems = delItems.count;
        deletedTransactions = delTx.count;
      }

      // 2. Shifts
      if (opt.shifts) {
        // Disconnect relations if transactions or expenses are kept
        if (!opt.transactions) {
          await tx.transaction.updateMany({ data: { shiftId: null } });
        }
        if (!opt.expenses) {
          await tx.expense.updateMany({ data: { shiftId: null } });
        }
        const delShifts = await tx.shift.deleteMany({});
        deletedShifts = delShifts.count;
      }

      // 3. Operational Expenses
      if (opt.expenses) {
        const delExp = await tx.expense.deleteMany({});
        deletedExpenses = delExp.count;
      }

      // 4. Inventory Mutation Logs
      if (opt.inventoryLogs) {
        const delLogs = await tx.inventoryLog.deleteMany({});
        deletedLogs = delLogs.count;
      }

      // 5. Stock Zeroing (if product catalog is preserved)
      if (opt.stock && !opt.products) {
        const resetProds = await tx.product.updateMany({ data: { stock: 0 } });
        const resetVars = await tx.productVariantOption.updateMany({ data: { stock: 0 } });
        zeroedProducts = resetProds.count;
        zeroedVariants = resetVars.count;
      }

      // 6. Delete Full Product Catalog & Variants (if explicitly requested)
      if (opt.products) {
        if (!opt.transactions) {
          await tx.transactionItem.updateMany({ data: { productId: null, variantOptionId: null } });
        }
        await tx.productImage.deleteMany({});
        await tx.productVariantOption.deleteMany({});
        await tx.inventoryLog.deleteMany({});
        const delProds = await tx.product.deleteMany({});
        deletedProducts = delProds.count;
        await tx.productType.deleteMany({});
        await tx.productVariant.deleteMany({});
      }

      // 7. Clear Selfie URLs on transactions if selfies deleted but transactions kept
      if (opt.selfies && !opt.transactions) {
        await tx.transaction.updateMany({ data: { selfieUrl: null } });
      }

      return {
        deletedTransactions,
        deletedItems,
        deletedExpenses,
        deletedLogs,
        deletedShifts,
        zeroedProducts,
        zeroedVariants,
        deletedProducts,
      };
    },
    { maxWait: 15000, timeout: 30000 }
  );

  let deletedSelfies = 0;
  if (opt.selfies) {
    const { deleteAllSelfieUploads } = await import('@/lib/uploads');
    deletedSelfies = await deleteAllSelfieUploads();
  }

  if (opt.shifts) {
    invalidateShiftCache();
  }

  return {
    ...result,
    deletedSelfies,
  };
}
