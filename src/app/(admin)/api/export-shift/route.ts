import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { parseInteger } from '@/lib/validation';
import { formatWibDate, formatWibDateTime } from '@/lib/dates';
import { buildTransactionsExcelBuffer } from '@/lib/excel';

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shiftIdParam = searchParams.get('shiftId');

  const shiftId = parseInteger(shiftIdParam, { min: 1 });
  if (!shiftId) {
    return new NextResponse('Valid Shift ID is required', { status: 400 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      transactions: {
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      },
      expenses: true,
    },
  });

  if (!shift) {
    return new NextResponse('Shift not found', { status: 404 });
  }

  let shiftOpex = 0;
  for (const exp of shift.expenses) {
    shiftOpex += exp.amount;
  }

  const startStr = formatWibDateTime(shift.startTime);
  const endStr = shift.endTime ? formatWibDateTime(shift.endTime) : 'Ongoing';
  let durationStr = '-';
  if (shift.endTime) {
    const ms = shift.endTime.getTime() - shift.startTime.getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    durationStr = `${hrs}h ${mins}m`;
  }

  const expectedCash = shift.expectedCash !== null ? shift.expectedCash : '-';
  const actualCash = shift.actualCash !== null ? shift.actualCash : '-';
  const discrepancy =
    shift.actualCash !== null && shift.expectedCash !== null ? shift.actualCash - shift.expectedCash : '-';

  const buf = await buildTransactionsExcelBuffer({
    transactions: shift.transactions,
    totalExpenses: shiftOpex,
    sheetName: 'Shift Transactions',
    shiftMeta: {
      startStr,
      endStr,
      durationStr,
      openedBy: shift.openedBy,
      closedBy: shift.closedBy || '-',
      initialCash: shift.initialCash,
      expectedCash,
      actualCash,
      discrepancy,
    },
  });

  const safeOpenedBy = shift.openedBy.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = formatWibDate(shift.startTime);
  const filename = `shift_export_${safeOpenedBy}_${dateStr}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
