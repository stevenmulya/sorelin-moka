import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PAID_STATUSES, STATUS } from '@/lib/constants';
import { UserError, cleanStr, requireInteger } from '@/lib/validation';
import type { Db } from '@/lib/services/orders';

export interface ShiftSummary {
  revenue: number;
  cashSales: number;
  qrisSales: number;
  debitSales: number;
  cogs: number;
  paidOrders: number;
  pendingCount: number;
  expenses: number; // Total operational expenses
  cashExpenses: number; // Expenses paid in Cash from the register
  nonCashExpenses: number; // Expenses paid via Bank Transfer or Owner Funds
}

/**
 * Single source of truth for shift calculations across all pages.
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
    expenses: totalExp,
    cashExpenses: cashExp,
    nonCashExpenses: nonCashExp,
  };

  for (const t of trxs) {
    if (t.status === STATUS.WAITING) {
      s.pendingCount++;
      continue;
    }
    s.paidOrders++;
    s.revenue += t.amount;
    if (t.paymentMethod === 'QRIS') s.qrisSales += t.amount;
    else if (t.paymentMethod === 'Debit') s.debitSales += t.amount;
    else s.cashSales += t.amount;
    for (const i of t.items) s.cogs += i.quantity * i.costPrice;
  }
  return s;
}

export function expectedCashOf(initialCash: number, summary: ShiftSummary): number {
  return Math.max(0, initialCash + summary.cashSales - summary.cashExpenses);
}

/** Open a shift. Enforces that only one shift can be Open at any time. */
export async function openShiftService(openedByRaw: string, initialCashRaw: unknown) {
  const openedBy = cleanStr(openedByRaw, 60);
  if (!openedBy) throw new UserError('Cashier name is required.');
  const initialCash = requireInteger(initialCashRaw as string | number, 'Initial cash float', { min: 0, max: 2_000_000_000 });

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.shift.findFirst({ where: { status: 'Open' } });
      if (existing) throw new UserError('There is already an active shift. Please close it first.');
      return tx.shift.create({ data: { openedBy, initialCash, status: 'Open', activeKey: 1 } });
    });
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
 *  2) Lock shift as closed
 *  3) Calculate expected cash from server records
 */
export async function closeShiftService(shiftId: number, actualCashRaw: unknown, closedByRaw: string) {
  const closedBy = cleanStr(closedByRaw, 60);
  if (!closedBy) throw new UserError('Closed by name is required.');
  const actualCash = requireInteger(actualCashRaw as string | number, 'Actual cash', { min: 0, max: 2_000_000_000 });

  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== 'Open') throw new UserError('This shift is already closed or does not exist.');

    await tx.transaction.updateMany({
      where: { shiftId, status: STATUS.WAITING },
      data: { status: STATUS.CANCELLED, cancelReason: 'Shift closed before payment was completed' },
    });

    const lock = await tx.shift.updateMany({
      where: { id: shiftId, status: 'Open' },
      data: { status: 'Closed', endTime: new Date(), activeKey: null, actualCash, closedBy },
    });
    if (lock.count === 0) throw new UserError('This shift is already closed.');

    const summary = await summarizeShift(tx, shiftId);
    const expectedCash = expectedCashOf(shift.initialCash, summary);
    await tx.shift.update({ where: { id: shiftId }, data: { expectedCash } });

    // Clear kitchen board for next shift
    await tx.transaction.updateMany({ where: { status: STATUS.PICKED_UP }, data: { status: STATUS.CLOSED } });

    return { expectedCash, actualCash };
  });
}

export async function createExpenseService(
  nameRaw: string, 
  amountRaw: unknown,
  paymentMethodRaw?: string
) {
  const name = cleanStr(nameRaw, 100);
  if (!name) throw new UserError('Expense name is required.');
  const amount = requireInteger(amountRaw as string | number, 'Expense amount', { min: 1, max: 2_000_000_000 });
  
  const paymentMethod = paymentMethodRaw === 'Transfer' || paymentMethodRaw === 'Owner' 
    ? paymentMethodRaw 
    : 'Cash';

  const shift = await prisma.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
  if (!shift) throw new UserError('Please open a shift before recording expenses.');

  // Validate drawer cash if paying with Cash Drawer
  if (paymentMethod === 'Cash') {
    const summary = await summarizeShift(prisma, shift.id);
    const availableCashInDrawer = shift.initialCash + summary.cashSales - summary.cashExpenses;
    if (amount > availableCashInDrawer) {
      throw new UserError(
        `Cannot withdraw Rp ${amount.toLocaleString('id-ID')} in cash. Cash drawer currently only has Rp ${Math.max(0, availableCashInDrawer).toLocaleString('id-ID')}. Please select 'Bank Transfer' or 'Owner Funds' if paid outside the register.`
      );
    }
  }

  const now = new Date();
  return prisma.expense.create({
    data: { name, amount, paymentMethod, startDate: now, endDate: now, shiftId: shift.id },
  });
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
  });
}
