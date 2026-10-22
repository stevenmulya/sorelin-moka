import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { resolveRange, formatWibDate } from '@/lib/dates';
import { buildTransactionsExcelBuffer } from '@/lib/excel';
import { getActiveShift } from '@/lib/services/shifts';

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const presetParam = searchParams.get('preset') || 'this_shift';

  const activeShift = await getActiveShift();

  const range = resolveRange(
    { preset: presetParam, start: startParam, end: endParam },
    activeShift ? activeShift.startTime : null,
  );

  const isThisShift = range.preset === 'this_shift';
  const shiftFilterId = activeShift ? activeShift.id : -1;

  const [transactions, expenseAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: isThisShift
        ? { shiftId: shiftFilterId }
        : {
            createdAt: {
              gte: range.start,
              lte: range.end,
            },
          },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.aggregate({
      where: isThisShift
        ? { shiftId: shiftFilterId }
        : {
            createdAt: {
              gte: range.start,
              lte: range.end,
            },
          },
      _sum: { amount: true },
    }),
  ]);

  const rangeOpex = expenseAgg._sum.amount ?? 0;

  const dateStartStr = range.startStr || formatWibDate(new Date());
  const dateEndStr = range.endStr || formatWibDate(new Date());
  const rangeDisplayStr =
    isThisShift
      ? activeShift
        ? `Shift #${activeShift.id} (${dateStartStr})`
        : 'No Active Shift'
      : range.preset === 'all'
        ? 'All Time'
        : dateStartStr === dateEndStr
          ? dateStartStr
          : `${dateStartStr} - ${dateEndStr}`;

  const buf = await buildTransactionsExcelBuffer({
    transactions,
    totalExpenses: rangeOpex,
    sheetName: 'Transactions',
    periodLabel: rangeDisplayStr,
  });

  const filename =
    range.preset === 'all'
      ? `transactions_all_time_${formatWibDate(new Date())}.xlsx`
      : `transactions_${dateStartStr}_to_${dateEndStr}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
