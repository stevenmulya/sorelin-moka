import { formatWibDate, formatWibTime } from '@/lib/dates';
import { PAID_STATUSES } from '@/lib/constants';
import { generateTrxCode } from '@/lib/utils';

export type ExportableTransaction = {
  id: number;
  customer: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  createdAt: Date;
  items: {
    quantity: number;
    productName: string;
    costPrice: number;
  }[];
};

export type ShiftMetadataRows = {
  startStr: string;
  endStr: string;
  durationStr: string;
  openedBy: string;
  closedBy: string;
  initialCash: number;
  expectedCash: number | string;
  actualCash: number | string;
  discrepancy: number | string;
};

export async function buildTransactionsExcelBuffer(options: {
  transactions: ExportableTransaction[];
  totalExpenses: number;
  sheetName: string;
  periodLabel?: string;
  shiftMeta?: ShiftMetadataRows;
}): Promise<Buffer> {
  const { transactions, totalExpenses, sheetName, periodLabel, shiftMeta } = options;

  let totalGross = 0;
  let totalCogs = 0;

  const rows: Record<string, string | number>[] = [];

  for (const trx of transactions) {
    const timeStr = formatWibTime(trx.createdAt);
    const dateStr = formatWibDate(trx.createdAt);
    const itemsStr = trx.items.map((i) => `${i.quantity}x ${i.productName}`).join('; ');

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
      'Transaction ID': generateTrxCode(trx.id, trx.createdAt, trx.customer),
      Date: dateStr,
      Time: timeStr,
      Customer: trx.customer || 'Guest',
      Status: trx.status,
      'Payment Method': trx.paymentMethod || '-',
      Items: itemsStr,
      'Order Amount': trx.amount,
      'Gross Revenue': isPaid ? trx.amount : 0,
      COGS: isPaid ? trxCogs : 0,
      'Gross Profit': isPaid ? trxGrossProfit : 0,
    });
  }

  rows.push({});

  if (shiftMeta) {
    rows.push({ 'Transaction ID': 'SHIFT SUMMARY' });
    rows.push({ 'Transaction ID': 'Start Time:', Date: shiftMeta.startStr });
    rows.push({ 'Transaction ID': 'End Time:', Date: shiftMeta.endStr });
    rows.push({ 'Transaction ID': 'Duration:', Date: shiftMeta.durationStr });
    rows.push({ 'Transaction ID': 'Opened By:', Date: shiftMeta.openedBy });
    rows.push({ 'Transaction ID': 'Closed By:', Date: shiftMeta.closedBy });
    rows.push({ 'Transaction ID': 'Initial Cash:', Date: shiftMeta.initialCash });
    rows.push({ 'Transaction ID': 'Expected Cash:', Date: shiftMeta.expectedCash });
    rows.push({ 'Transaction ID': 'Actual Cash:', Date: shiftMeta.actualCash });
    rows.push({ 'Transaction ID': 'Discrepancy:', Date: shiftMeta.discrepancy });
    rows.push({});
  }

  const totalGrossProfit = totalGross - totalCogs;
  const netProfit = totalGrossProfit - totalExpenses;

  rows.push(
    periodLabel
      ? { 'Transaction ID': 'FINANCIAL SUMMARY', Date: periodLabel }
      : { 'Transaction ID': 'FINANCIAL SUMMARY' },
  );
  rows.push({ 'Transaction ID': 'Total Gross Revenue:', Date: totalGross });
  rows.push({ 'Transaction ID': 'Total COGS:', Date: totalCogs });
  rows.push({ 'Transaction ID': 'Total Gross Profit:', Date: totalGrossProfit });
  rows.push({ 'Transaction ID': 'Total Expenses:', Date: totalExpenses });
  rows.push({ 'Transaction ID': 'NET PROFIT:', Date: netProfit });

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  worksheet['!cols'] = [
    { wch: 25 }, // Transaction ID / Summary Metric
    { wch: 18 }, // Date / Summary Value
    { wch: 10 }, // Time
    { wch: 20 }, // Customer
    { wch: 16 }, // Status
    { wch: 16 }, // Payment Method
    { wch: 42 }, // Items
    { wch: 15 }, // Order Amount
    { wch: 15 }, // Gross Revenue
    { wch: 15 }, // COGS
    { wch: 15 }, // Gross Profit
  ];

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
