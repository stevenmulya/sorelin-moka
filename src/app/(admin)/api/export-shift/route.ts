import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shiftIdParam = searchParams.get('shiftId');

  if (!shiftIdParam) {
    return new NextResponse('Shift ID is required', { status: 400 });
  }

  const shiftId = Number(shiftIdParam);

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      transactions: {
        include: { items: true },
        orderBy: { createdAt: 'asc' }
      },
      expenses: true
    }
  });

  if (!shift) {
    return new NextResponse('Shift not found', { status: 404 });
  }

  let totalGross = 0;
  let totalCogs = 0;
  
  const rows = [];
  
  for (const trx of shift.transactions) {
    const timeStr = trx.createdAt.toLocaleTimeString('id-ID', { hour12: false });
    const dateStr = trx.createdAt.toLocaleDateString('id-ID');
    
    // Format items as a single string
    const itemsStr = trx.items.map(i => `${i.quantity}x ${i.productName}`).join('; ');
    
    let trxCogs = 0;
    for (const item of trx.items) {
      trxCogs += item.quantity * item.costPrice;
    }
    
    const trxGrossProfit = trx.amount - trxCogs;
    
    if (trx.status !== 'Cancelled') {
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
      "Gross Profit": trxGrossProfit
    });
  }

  // Calculate OPEX for this shift
  let shiftOpex = 0;
  for (const exp of shift.expenses) {
    shiftOpex += exp.amount;
  }

  // Add Empty Row
  rows.push({});

  // Add Summary Rows
  const totalGrossProfit = totalGross - totalCogs;
  const trueNetProfit = totalGrossProfit - shiftOpex;
  
  const startStr = shift.startTime.toLocaleString('id-ID');
  const endStr = shift.endTime ? shift.endTime.toLocaleString('id-ID') : 'Ongoing';
  let durationStr = '-';
  if (shift.endTime) {
    const ms = shift.endTime.getTime() - shift.startTime.getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    durationStr = `${hrs}h ${mins}m`;
  }

  rows.push({ "Transaction ID": "SHIFT SUMMARY" });
  rows.push({ "Transaction ID": "Start Time:", "Date": startStr });
  rows.push({ "Transaction ID": "End Time:", "Date": endStr });
  rows.push({ "Transaction ID": "Duration:", "Date": durationStr });
  rows.push({ "Transaction ID": "Opened By:", "Date": shift.openedBy });
  rows.push({ "Transaction ID": "Closed By:", "Date": shift.closedBy || '-' });
  rows.push({ "Transaction ID": "Initial Cash:", "Date": shift.initialCash });
  rows.push({ "Transaction ID": "Actual Cash:", "Date": shift.actualCash || '-' });
  rows.push({});
  rows.push({ "Transaction ID": "FINANCIAL SUMMARY" });
  rows.push({ "Transaction ID": "Total Gross Revenue:", "Date": totalGross });
  rows.push({ "Transaction ID": "Total COGS:", "Date": totalCogs });
  rows.push({ "Transaction ID": "Total Gross Profit:", "Date": totalGrossProfit });
  rows.push({ "Transaction ID": "Total Expenses:", "Date": shiftOpex });
  rows.push({ "Transaction ID": "NET PROFIT:", "Date": trueNetProfit });

  // Generate XLSX Buffer
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Shift Transactions");
  
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

  const safeOpenedBy = shift.openedBy.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = shift.startTime.toISOString().split('T')[0];
  const filename = `shift_export_${safeOpenedBy}_${dateStr}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
