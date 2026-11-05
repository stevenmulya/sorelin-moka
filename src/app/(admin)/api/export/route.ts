import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { resolveRange, formatWibDate, formatWibDateTime } from '@/lib/dates';
import { buildTransactionsExcelBuffer } from '@/lib/excel';
import { getActiveShift, summarizeShift, expectedCashOf } from '@/lib/services/shifts';

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
  const targetShift =
    activeShift ??
    (presetParam === 'this_shift'
      ? await prisma.shift.findFirst({ orderBy: { startTime: 'desc' } })
      : null);

  const range = resolveRange(
    { preset: presetParam, start: startParam, end: endParam },
    targetShift ? targetShift.startTime : null,
  );

  const isThisShift = range.preset === 'this_shift';
  const shiftFilterId = targetShift ? targetShift.id : -1;

  const expenseWhere = isThisShift
    ? { shiftId: shiftFilterId }
    : {
        createdAt: {
          gte: range.start,
          lte: range.end,
        },
      };

  const [transactions, expenseAgg, expensesList] = await Promise.all([
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
      where: expenseWhere,
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const rangeOpex = expenseAgg._sum.amount ?? 0;

  const dateStartStr = range.startStr || formatWibDate(new Date());
  const dateEndStr = range.endStr || formatWibDate(new Date());
  const rangeDisplayStr =
    isThisShift
      ? targetShift
        ? `Shift #${targetShift.id} (${dateStartStr})`
        : 'No Shift Data'
      : range.preset === 'all'
        ? 'All Time'
        : dateStartStr === dateEndStr
          ? dateStartStr
          : `${dateStartStr} - ${dateEndStr}`;

  let shiftMeta;
  if (isThisShift && targetShift) {
    const startStr = formatWibDateTime(targetShift.startTime);
    const endStr = targetShift.endTime ? formatWibDateTime(targetShift.endTime) : 'Ongoing';
    let durationStr = '-';
    if (targetShift.endTime) {
      const ms = targetShift.endTime.getTime() - targetShift.startTime.getTime();
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      durationStr = `${hrs}h ${mins}m`;
    }
    const summary = await summarizeShift(prisma, targetShift.id);
    const computedExpected = targetShift.expectedCash ?? expectedCashOf(targetShift.initialCash, summary);
    const actualCash = targetShift.actualCash !== null ? targetShift.actualCash : '-';
    const discrepancy =
      targetShift.actualCash !== null ? targetShift.actualCash - computedExpected : '-';

    shiftMeta = {
      startStr,
      endStr,
      durationStr,
      openedBy: targetShift.openedBy,
      closedBy: targetShift.closedBy || '-',
      initialCash: targetShift.initialCash,
      expectedCash: computedExpected,
      actualCash,
      discrepancy,
    };
  }

  const buf = await buildTransactionsExcelBuffer({
    transactions,
    totalExpenses: rangeOpex,
    expensesList,
    sheetName: 'Transactions',
    periodLabel: rangeDisplayStr,
    shiftMeta,
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
