import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { resolveRange, formatWibDate, formatWibTime } from '@/lib/dates';
import { PAID_STATUSES } from '@/lib/constants';

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

  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  const range = resolveRange(
    { preset: presetParam, start: startParam, end: endParam },
    activeShift ? activeShift.startTime : null
  );

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: range.start,
        lte: range.end,
      },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate OPEX for this range
  let rangeOpex = 0;
  if (range.preset === 'this_shift' && activeShift) {
    const shiftExpenses = await prisma.expense.findMany({
      where: { shiftId: activeShift.id }
    });
    for (const exp of shiftExpenses) {
      rangeOpex += exp.amount;
    }
  } else {
    const activeExpenses = await prisma.expense.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end }
      }
    });
    for (const exp of activeExpenses) {
      rangeOpex += exp.amount;
    }
  }

  // Generate Excel Data
  let totalGross = 0;
  let totalCogs = 0;
  
  const rows = [];
  
  for (const trx of transactions) {
    const timeStr = formatWibTime(trx.createdAt);
    const dateStr = formatWibDate(trx.createdAt);
    
    // Format items as a single string
    const itemsStr = trx.items.map(i => `${i.quantity}x ${i.productName}`).join('; ');
    
    let trxCogs = 0;
    for (const item of trx.items) {
      trxCogs += item.quantity * item.costPrice;
    }
    
    const trxGrossProfit = trx.amount - trxCogs;
    const isPaid = PAID_STATUSES.includes(trx.status);

    if (isPaid) {
      totalGross += trx.amount;
      totalCogs += trxCogs;
    }

    rows.push({
      "Transaction ID": trx.id,
      "Date": dateStr,
      "Time": timeStr,
      "Customer": trx.customer || 'Guest',
      "Status": trx.status,
      "Payment Method": trx.paymentMethod || '-',
      "Items": itemsStr,
      "Gross Revenue": trx.amount,
      "COGS": trxCogs,
      "Gross Profit": isPaid ? trxGrossProfit : 0
    });
  }

  // Add Empty Row
  rows.push({});

  // Add Summary Rows
  const totalGrossProfit = totalGross - totalCogs;
  const trueNetProfit = totalGrossProfit - rangeOpex;

  const dateStartStr = formatWibDate(range.start);
  const dateEndStr = formatWibDate(range.end);
  const rangeDisplayStr = dateStartStr === dateEndStr ? dateStartStr : `${dateStartStr} - ${dateEndStr}`;
  
  rows.push({ "Transaction ID": "FINANCIAL SUMMARY", "Date": rangeDisplayStr });
  rows.push({ "Transaction ID": "Total Gross Revenue:", "Date": totalGross });
  rows.push({ "Transaction ID": "Total COGS:", "Date": totalCogs });
  rows.push({ "Transaction ID": "Total Gross Profit:", "Date": totalGrossProfit });
  rows.push({ "Transaction ID": "Total Expenses:", "Date": rangeOpex });
  rows.push({ "Transaction ID": "NET PROFIT:", "Date": trueNetProfit });

  // Generate XLSX Buffer
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // ID / Summary Metric
    { wch: 15 }, // Date / Summary Value
    { wch: 10 }, // Time
    { wch: 20 }, // Customer
    { wch: 15 }, // Status
    { wch: 15 }, // Payment Method
    { wch: 40 }, // Items
    { wch: 15 }, // Gross
    { wch: 15 }, // COGS
    { wch: 15 }, // Profit
  ];

  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = `all_transaction_${dateStartStr}_to_${dateEndStr}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
