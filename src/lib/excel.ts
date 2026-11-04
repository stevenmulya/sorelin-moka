import { formatWibDate, formatWibTime } from '@/lib/dates';
import { PAID_STATUSES, STATUS } from '@/lib/constants';
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
    price?: number;
    selectedVariant?: string | null;
    isBundle?: boolean;
    bundleContents?: string | null;
  }[];
};

export type ExportableExpense = {
  id: number;
  name: string;
  amount: number;
  paymentMethod: string;
  createdAt: Date;
  shiftId?: number | null;
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

function parseFlavors(contents?: string | null): Array<{ flavorName: string; quantity: number }> {
  if (!contents) return [];
  const results: Array<{ flavorName: string; quantity: number }> = [];
  const clean = contents
    .replace(/\(\+[^)]+\)/g, '')
    .replace(/\(include\)/gi, '')
    .replace(/\(termasuk\)/gi, '')
    .trim();
  const parts = clean.split(/[,+]|(?:\s*\+\s*)/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const prefixMatch = part.match(/^\(?(\d+)\s*x\)?\s*(.+)$/i);
    if (prefixMatch) {
      results.push({ quantity: parseInt(prefixMatch[1], 10), flavorName: prefixMatch[2].replace(/[()]/g, '').trim() });
      continue;
    }
    const suffixMatch = part.match(/^(.+?)\s*\(?(\d+)\s*x\)?$/i);
    if (suffixMatch) {
      results.push({ quantity: parseInt(suffixMatch[2], 10), flavorName: suffixMatch[1].replace(/[()]/g, '').trim() });
      continue;
    }
    results.push({ quantity: 1, flavorName: part.replace(/[()]/g, '').trim() });
  }
  return results;
}

export async function buildTransactionsExcelBuffer(options: {
  transactions: ExportableTransaction[];
  totalExpenses: number;
  expensesList?: ExportableExpense[];
  sheetName: string;
  periodLabel?: string;
  shiftMeta?: ShiftMetadataRows;
}): Promise<Buffer> {
  const { transactions, totalExpenses, expensesList, sheetName, periodLabel, shiftMeta } = options;

  let totalGross = 0;
  let totalCogs = 0;
  let totalCashSales = 0;
  let totalQrisSales = 0;
  let totalDebitSales = 0;
  let paidCount = 0;
  let cancelledCount = 0;

  // Track product-level sales (only from paid transactions)
  const productSalesMap = new Map<
    string,
    { qty: number; revenue: number; cogs: number }
  >();

  // Track flavor-level physical units (single sales + bundle contents)
  const flavorSalesMap = new Map<
    string,
    { singleQty: number; bundleQty: number; totalQty: number }
  >();

  const rows: Record<string, string | number>[] = [];

  for (const trx of transactions) {
    const timeStr = formatWibTime(trx.createdAt);
    const dateStr = formatWibDate(trx.createdAt);
    const itemsStr = trx.items
      .map((i) => {
        let name = `${i.quantity}x ${i.productName}`;
        if (i.selectedVariant) name += ` (Flavor: ${i.selectedVariant})`;
        if (i.isBundle && i.bundleContents) name += ` [Bundle: ${i.bundleContents}]`;
        return name;
      })
      .join('; ');

    let trxCogs = 0;
    for (const item of trx.items) {
      trxCogs += item.quantity * item.costPrice;
    }

    const trxGrossProfit = trx.amount - trxCogs;
    const isPaid = PAID_STATUSES.includes(trx.status);

    if (isPaid) {
      totalGross += trx.amount;
      totalCogs += trxCogs;
      paidCount++;

      const method = trx.paymentMethod || 'Cash';
      if (method === 'QRIS') totalQrisSales += trx.amount;
      else if (method === 'Debit') totalDebitSales += trx.amount;
      else totalCashSales += trx.amount;

      // Aggregate Product Sales
      for (const item of trx.items) {
        const pName = item.productName || 'Unknown Product';
        const lineRev = (item.price ?? (trx.amount / (trx.items.length || 1))) * item.quantity;
        const lineCogs = item.costPrice * item.quantity;

        const currentP = productSalesMap.get(pName) || { qty: 0, revenue: 0, cogs: 0 };
        currentP.qty += item.quantity;
        currentP.revenue += lineRev;
        currentP.cogs += lineCogs;
        productSalesMap.set(pName, currentP);

        // Aggregate Flavor Variants
        if (item.selectedVariant) {
          const fName = item.selectedVariant.trim();
          const currentF = flavorSalesMap.get(fName) || { singleQty: 0, bundleQty: 0, totalQty: 0 };
          currentF.singleQty += item.quantity;
          currentF.totalQty += item.quantity;
          flavorSalesMap.set(fName, currentF);
        }

        if (item.isBundle && item.bundleContents) {
          const bundleFlavors = parseFlavors(item.bundleContents);
          for (const bf of bundleFlavors) {
            const fName = bf.flavorName.trim();
            const needed = bf.quantity * item.quantity;
            const currentF = flavorSalesMap.get(fName) || { singleQty: 0, bundleQty: 0, totalQty: 0 };
            currentF.bundleQty += needed;
            currentF.totalQty += needed;
            flavorSalesMap.set(fName, currentF);
          }
        }
      }
    } else if (trx.status === STATUS.CANCELLED) {
      cancelledCount++;
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
    rows.push({ 'Transaction ID': 'SHIFT RECONCILIATION SUMMARY' });
    rows.push({ 'Transaction ID': 'Start Time:', Date: shiftMeta.startStr });
    rows.push({ 'Transaction ID': 'End Time:', Date: shiftMeta.endStr });
    rows.push({ 'Transaction ID': 'Duration:', Date: shiftMeta.durationStr });
    rows.push({ 'Transaction ID': 'Opened By:', Date: shiftMeta.openedBy });
    rows.push({ 'Transaction ID': 'Closed By:', Date: shiftMeta.closedBy });
    rows.push({ 'Transaction ID': 'Initial Cash (Modal Awal):', Date: shiftMeta.initialCash });
    rows.push({ 'Transaction ID': 'Expected Cash in Drawer:', Date: shiftMeta.expectedCash });
    rows.push({ 'Transaction ID': 'Actual Cash Counted:', Date: shiftMeta.actualCash });
    rows.push({ 'Transaction ID': 'Cash Discrepancy (Selisih):', Date: shiftMeta.discrepancy });
    rows.push({});
  }

  const totalGrossProfit = totalGross - totalCogs;
  const netProfit = totalGrossProfit - totalExpenses;

  rows.push(
    periodLabel
      ? { 'Transaction ID': 'EXECUTIVE FINANCIAL SUMMARY', Date: periodLabel }
      : { 'Transaction ID': 'EXECUTIVE FINANCIAL SUMMARY' },
  );
  rows.push({ 'Transaction ID': 'Total Gross Revenue (Omset):', Date: totalGross });
  rows.push({ 'Transaction ID': '  - Cash Sales:', Date: totalCashSales });
  rows.push({ 'Transaction ID': '  - QRIS Sales:', Date: totalQrisSales });
  rows.push({ 'Transaction ID': '  - Debit / Card Sales:', Date: totalDebitSales });
  rows.push({ 'Transaction ID': 'Total COGS (HPP):', Date: totalCogs });
  rows.push({ 'Transaction ID': 'Total Gross Profit (Laba Kotor):', Date: totalGrossProfit });
  rows.push({ 'Transaction ID': 'Total Operational Expenses (Biaya):', Date: totalExpenses });
  rows.push({ 'Transaction ID': 'NET PROFIT (Laba Bersih):', Date: netProfit });
  rows.push({ 'Transaction ID': 'Total Paid Orders:', Date: paidCount });
  rows.push({ 'Transaction ID': 'Total Cancelled Orders:', Date: cancelledCount });

  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Transactions
  // -------------------------------------------------------------
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  worksheet['!cols'] = [
    { wch: 32 }, // Transaction ID / Summary Metric
    { wch: 18 }, // Date / Summary Value
    { wch: 10 }, // Time
    { wch: 20 }, // Customer
    { wch: 16 }, // Status
    { wch: 16 }, // Payment Method
    { wch: 45 }, // Items
    { wch: 15 }, // Order Amount
    { wch: 15 }, // Gross Revenue
    { wch: 15 }, // COGS
    { wch: 15 }, // Gross Profit
  ];

  // -------------------------------------------------------------
  // Sheet 2: Product Sales (Rekap Penjualan Produk)
  // -------------------------------------------------------------
  const productRows: Record<string, string | number>[] = [];
  const sortedProducts = Array.from(productSalesMap.entries()).sort((a, b) => b[1].qty - a[1].qty);

  let sumProdQty = 0;
  let sumProdRev = 0;
  let sumProdCogs = 0;

  sortedProducts.forEach(([name, data], idx) => {
    const profit = data.revenue - data.cogs;
    const margin = data.revenue > 0 ? `${Math.round((profit / data.revenue) * 100)}%` : '0%';
    sumProdQty += data.qty;
    sumProdRev += data.revenue;
    sumProdCogs += data.cogs;

    productRows.push({
      No: idx + 1,
      'Product Name': name,
      'Units Sold': data.qty,
      'Total Revenue (Rp)': data.revenue,
      'Total COGS (Rp)': data.cogs,
      'Gross Profit (Rp)': profit,
      'Margin (%)': margin,
    });
  });

  if (productRows.length > 0) {
    productRows.push({
      No: '' as unknown as number,
      'Product Name': 'TOTAL',
      'Units Sold': sumProdQty,
      'Total Revenue (Rp)': sumProdRev,
      'Total COGS (Rp)': sumProdCogs,
      'Gross Profit (Rp)': sumProdRev - sumProdCogs,
      'Margin (%)': sumProdRev > 0 ? `${Math.round(((sumProdRev - sumProdCogs) / sumProdRev) * 100)}%` : '0%',
    });

    const prodWorksheet = XLSX.utils.json_to_sheet(productRows);
    prodWorksheet['!cols'] = [
      { wch: 6 },
      { wch: 35 },
      { wch: 14 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, prodWorksheet, 'Product Sales');
  }

  // -------------------------------------------------------------
  // Sheet 3: Variant Breakdown (Rekap Konsumsi Rasa Roti)
  // -------------------------------------------------------------
  const flavorRows: Record<string, string | number>[] = [];
  const sortedFlavors = Array.from(flavorSalesMap.entries()).sort((a, b) => b[1].totalQty - a[1].totalQty);

  let sumFlavorSingle = 0;
  let sumFlavorBundle = 0;
  let sumFlavorTotal = 0;

  sortedFlavors.forEach(([flavorName, data], idx) => {
    sumFlavorSingle += data.singleQty;
    sumFlavorBundle += data.bundleQty;
    sumFlavorTotal += data.totalQty;

    flavorRows.push({
      No: idx + 1,
      'Flavor / Variant Name': flavorName,
      'Single Items Sold (pcs)': data.singleQty,
      'Bundle Box Contents (pcs)': data.bundleQty,
      'TOTAL PIECES SOLD (pcs)': data.totalQty,
    });
  });

  if (flavorRows.length > 0) {
    flavorRows.push({
      No: '' as unknown as number,
      'Flavor / Variant Name': 'TOTAL BAKERY CONSUMPTION',
      'Single Items Sold (pcs)': sumFlavorSingle,
      'Bundle Box Contents (pcs)': sumFlavorBundle,
      'TOTAL PIECES SOLD (pcs)': sumFlavorTotal,
    });

    const flavorWorksheet = XLSX.utils.json_to_sheet(flavorRows);
    flavorWorksheet['!cols'] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 24 },
      { wch: 26 },
      { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, flavorWorksheet, 'Variant Breakdown');
  }

  // -------------------------------------------------------------
  // Sheet 4: Expenses (Rincian Biaya Operasional)
  // -------------------------------------------------------------
  if (expensesList && expensesList.length > 0) {
    const expRows = expensesList.map((exp, idx) => ({
      No: idx + 1,
      'Expense ID': `#${exp.id}`,
      Date: formatWibDate(exp.createdAt),
      Time: formatWibTime(exp.createdAt),
      Description: exp.name,
      'Payment Method': exp.paymentMethod,
      Amount: exp.amount,
      Shift: exp.shiftId ? `#${exp.shiftId}` : '-',
    }));

    expRows.push({
      No: '' as unknown as number,
      'Expense ID': '',
      Date: '',
      Time: '',
      Description: 'TOTAL EXPENSES',
      'Payment Method': '',
      Amount: totalExpenses,
      Shift: '',
    });

    const expWorksheet = XLSX.utils.json_to_sheet(expRows);
    expWorksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 14 },
      { wch: 10 },
      { wch: 32 },
      { wch: 16 },
      { wch: 16 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(workbook, expWorksheet, 'Expenses');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
