import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const preset = searchParams.get('preset') || 'this_shift';

  let startDate = new Date();
  let endDate = new Date();

  if (preset === 'this_shift') {
    const activeShift = await prisma.shift.findFirst({
      where: { status: 'Open' },
      orderBy: { startTime: 'desc' }
    });
    if (activeShift) {
      startDate = new Date(activeShift.startTime);
      endDate = new Date();
    } else {
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    }
  } else if (preset === 'all') {
    startDate = new Date(2000, 0, 1);
    endDate = new Date(2100, 0, 1);
  } else {
    if (startParam) startDate = new Date(startParam);
    startDate.setHours(0, 0, 0, 0);
    if (endParam) endDate = new Date(endParam);
    endDate.setHours(23, 59, 59, 999);
  }

  if (startDate > endDate && preset !== 'this_shift' && preset !== 'all') {
    const temp = startDate;
    startDate = new Date(endDate);
    startDate.setHours(0,0,0,0);
    endDate = new Date(temp);
    endDate.setHours(23,59,59,999);
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });

  // Calculate OPEX for this range
  const activeExpenses = await prisma.expense.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate }
    }
  });
  
  let rangeOpex = 0;
  for (const exp of activeExpenses) {
    rangeOpex += exp.amount;
  }

  // Generate Excel Data
  let totalGross = 0;
  let totalCogs = 0;
  
  const rows = [];
  
  for (const trx of transactions) {
    const timeStr = trx.createdAt.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = trx.createdAt.toLocaleDateString('id-ID');
    
    // Format items as a single string
    const itemsStr = trx.items.map(i => `${i.quantity}x ${i.productName}`).join('; ');
    
    let trxCogs = 0;
    for (const item of trx.items) {
      trxCogs += item.quantity * item.costPrice;
    }
    
    const trxGrossProfit = trx.amount - trxCogs;
    
    totalGross += trx.amount;
    totalCogs += trxCogs;

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
      "Gross Profit": trxGrossProfit
    });
  }

  // Add Empty Row
  rows.push({});

  // Add Summary Rows
  const totalGrossProfit = totalGross - totalCogs;
  const trueNetProfit = totalGrossProfit - rangeOpex;

  const rangeStr = startDate === endDate ? startDate.toLocaleDateString('id-ID') : `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
  
  rows.push({ "Transaction ID": "FINANCIAL SUMMARY", "Date": rangeStr });
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

  const dateStrStart = startDate.toISOString().split('T')[0];
  const dateStrEnd = endDate.toISOString().split('T')[0];
  const filename = `all_transaction_${dateStrStart}_to_${dateStrEnd}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
