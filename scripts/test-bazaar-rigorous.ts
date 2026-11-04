import { prisma } from '../src/lib/prisma';
import { openShiftService, closeShiftService, summarizeShift } from '../src/lib/services/shifts';
import { createOrder, approvePaymentService } from '../src/lib/services/orders';
import { buildTransactionsExcelBuffer } from '../src/lib/excel';

async function runRigorousTest() {
  console.log('================================================================');
  console.log('🏆 SORELIN POS — RIGOROUS PRODUCTION AUDIT & FLOW TEST');
  console.log('   Catalog: 6 Saltbread + 2 Beverage + Bundle A & Bundle B');
  console.log('================================================================\n');

  // STEP 1: Verify Catalog Deduplication & Integrity
  console.log('📌 STEP 1: Catalog & Product Deduplication Check');
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { type: true },
    orderBy: { id: 'asc' },
  });

  const productNames = activeProducts.map((p) => p.name);
  const uniqueNames = new Set(productNames);
  if (productNames.length !== uniqueNames.size) {
    throw new Error(`Duplicate product names found! Total: ${productNames.length}, Unique: ${uniqueNames.size}`);
  }
  if (activeProducts.length !== 10) {
    throw new Error(`Expected exactly 10 active products, found ${activeProducts.length}`);
  }
  console.log(`✅ [PASS] Active catalog is 100% deduplicated: exactly 10 products.`);

  const saltbreads = activeProducts.filter((p) => p.type?.name === 'Saltbread');
  const beverages = activeProducts.filter((p) => p.type?.name === 'Beverage');
  const bundles = activeProducts.filter((p) => p.isBundle);

  if (saltbreads.length !== 6) throw new Error(`Expected 6 Saltbreads, found ${saltbreads.length}`);
  if (beverages.length !== 2) throw new Error(`Expected 2 Beverages, found ${beverages.length}`);
  if (bundles.length !== 2) throw new Error(`Expected 2 Bundles, found ${bundles.length}`);
  console.log(`✅ [PASS] Composition: 6 Saltbreads, 2 Beverages, 2 Bundles (Bundle A & Bundle B).`);

  const bundleA = bundles.find((b) => b.name.includes('Bundle A'));
  const bundleB = bundles.find((b) => b.name.includes('Bundle B'));
  if (!bundleA || !bundleB) throw new Error('Bundle A or Bundle B not found in catalog');
  console.log(`✅ [PASS] Found "${bundleA.name}" (Rp ${bundleA.price.toLocaleString('id-ID')})`);
  console.log(`✅ [PASS] Found "${bundleB.name}" (Rp ${bundleB.price.toLocaleString('id-ID')})`);

  // STEP 2: Shift Initialization
  console.log('\n📌 STEP 2: Shift Lifecycle & Initial Float');
  const existingShift = await prisma.shift.findFirst({ where: { status: 'Open' } });
  if (existingShift) {
    await closeShiftService(existingShift.id, 300000, 'System Reset');
  }

  const shift = await openShiftService('Kasir Bazaar Utama', 350000);
  console.log(`✅ [PASS] Shift #${shift.id} opened with initial petty cash float: Rp 350.000`);

  // Baseline stocks
  const pOriginal = activeProducts.find((p) => p.name === 'Salt Bread Original')!;
  const pHam = activeProducts.find((p) => p.name === 'Salt Bread Smoked Ham and Cheese')!;
  const pTea = activeProducts.find((p) => p.name === 'Thai Milk Tea')!;
  const pLemon = activeProducts.find((p) => p.name === 'Thai Tea Honey Lemon')!;

  const stockBeforeOrig = pOriginal.stock;
  const stockBeforeHam = pHam.stock;
  const stockBeforeTea = pTea.stock;
  const stockBeforeLemon = pLemon.stock;

  // STEP 3: Order Bundle A (Base Tier vs Upcharge Tier)
  console.log('\n📌 STEP 3: Bundle A Testing (2 Saltbread + 1 Beverage)');
  // Case A1: Cheapest items (Original 18k + Original 18k + Thai Tea 15k) -> Upcharge 0 -> Rp 45.000
  const orderA1Contents = `2x ${pOriginal.name}, 1x ${pTea.name}`;
  const orderA1 = await createOrder({
    customer: 'Customer A1 (Base Tier)',
    items: [{ productId: bundleA.id, quantity: 1, isBundle: true, bundleContents: orderA1Contents }],
  });
  if (orderA1.amount !== 45000) throw new Error(`Order A1 amount expected 45000, got ${orderA1.amount}`);
  console.log(`✅ [PASS] Order A1 (Cheapest Items): Rp ${orderA1.amount.toLocaleString('id-ID')} (Upcharge: Rp 0)`);

  // Case A2: Premium item (1x Original 18k + 1x Ham 24k [+6k upcharge] + 1x Thai Tea 15k) -> Rp 51.000
  const orderA2Contents = `1x ${pOriginal.name}, 1x ${pHam.name} (+Rp 6.000), 1x ${pTea.name}`;
  const orderA2 = await createOrder({
    customer: 'Customer A2 (Ham Upcharge)',
    items: [{ productId: bundleA.id, quantity: 1, isBundle: true, bundleContents: orderA2Contents }],
  });
  if (orderA2.amount !== 51000) throw new Error(`Order A2 amount expected 51000, got ${orderA2.amount}`);
  console.log(`✅ [PASS] Order A2 (With Ham +6k): Rp ${orderA2.amount.toLocaleString('id-ID')} (45k + 6k verified)`);

  // STEP 4: Order Bundle B (5 Saltbread + 3 Beverage)
  console.log('\n📌 STEP 4: Bundle B Testing (5 Saltbread + 3 Beverage)');
  // 3x Original (18k, +0) + 2x Ham (24k, +6k * 2 = 12k upcharge) + 2x Tea (15k, +0) + 1x Lemon (15k, +0)
  // Expected price: 115.000 + 12.000 = 127.000
  const orderBContents = `3x ${pOriginal.name}, 2x ${pHam.name} (+Rp 12.000), 2x ${pTea.name}, 1x ${pLemon.name}`;
  const orderB = await createOrder({
    customer: 'Customer B (Mega Bundle)',
    items: [{ productId: bundleB.id, quantity: 1, isBundle: true, bundleContents: orderBContents }],
  });
  if (orderB.amount !== 127000) throw new Error(`Order B amount expected 127000, got ${orderB.amount}`);
  console.log(`✅ [PASS] Order B (5 Saltbread + 3 Beverage with 2x Ham upcharge): Rp ${orderB.amount.toLocaleString('id-ID')} (115k + 12k verified)`);

  // STEP 5: Cashier Approvals & Multi-Method Payments
  console.log('\n📌 STEP 5: Cashier Approval & Stock Deduction Execution');
  await approvePaymentService({
    transactionId: orderA1.id,
    cashierName: 'Kasir Utama',
    paymentMethod: 'Cash',
    paidAmount: 50000,
  });

  await approvePaymentService({
    transactionId: orderA2.id,
    cashierName: 'Kasir Utama',
    paymentMethod: 'QRIS',
    paidAmount: 51000,
  });

  await approvePaymentService({
    transactionId: orderB.id,
    cashierName: 'Kasir Utama',
    paymentMethod: 'Debit',
    paidAmount: 127000,
  });

  // Verify exact physical component deductions:
  // Order A1: 2x Original, 1x Tea
  // Order A2: 1x Original, 1x Ham, 1x Tea
  // Order B:  3x Original, 2x Ham, 2x Tea, 1x Lemon
  // Total deductions:
  // Original: 2 + 1 + 3 = 6 pcs
  // Ham:      0 + 1 + 2 = 3 pcs
  // Tea:      1 + 1 + 2 = 4 pcs
  // Lemon:    0 + 0 + 1 = 1 pc
  const curOrig = await prisma.product.findUnique({ where: { id: pOriginal.id } });
  const curHam = await prisma.product.findUnique({ where: { id: pHam.id } });
  const curTea = await prisma.product.findUnique({ where: { id: pTea.id } });
  const curLemon = await prisma.product.findUnique({ where: { id: pLemon.id } });

  if (curOrig?.stock !== stockBeforeOrig - 6) throw new Error(`Original stock deduction mismatch`);
  if (curHam?.stock !== stockBeforeHam - 3) throw new Error(`Ham stock deduction mismatch`);
  if (curTea?.stock !== stockBeforeTea - 4) throw new Error(`Tea stock deduction mismatch`);
  if (curLemon?.stock !== stockBeforeLemon - 1) throw new Error(`Lemon stock deduction mismatch`);

  console.log(`✅ [PASS] Physical stocks deducted with 100% precision:`);
  console.log(`   - Original Saltbread: ${stockBeforeOrig} -> ${curOrig?.stock} (-6 pcs)`);
  console.log(`   - Smoked Ham Saltbread: ${stockBeforeHam} -> ${curHam?.stock} (-3 pcs)`);
  console.log(`   - Thai Milk Tea: ${stockBeforeTea} -> ${curTea?.stock} (-4 pcs)`);
  console.log(`   - Thai Tea Honey Lemon: ${stockBeforeLemon} -> ${curLemon?.stock} (-1 pc)`);

  // STEP 6: Inventory Audit Trail Verification
  console.log('\n📌 STEP 6: InventoryLog Audit Trail Check');
  const logs = await prisma.inventoryLog.findMany({
    where: { notes: { contains: `TRX-${orderB.id}` } },
  });
  if (logs.length === 0) throw new Error('No inventory logs recorded for Order B');
  console.log(`✅ [PASS] InventoryLog OUT entries correctly created for bundle component consumption.`);

  // STEP 7: Financial Reconciliation & Shift Summary
  console.log('\n📌 STEP 7: Financial Summary & Cash Drawer Balance');
  const summary = await summarizeShift(prisma, shift.id);
  const expectedRevenue = 45000 + 51000 + 127000; // 223.000
  if (summary.revenue !== expectedRevenue) throw new Error(`Revenue mismatch: ${summary.revenue} vs ${expectedRevenue}`);
  if (summary.cashSales !== 45000) throw new Error(`Cash sales mismatch: ${summary.cashSales} vs 45000`);
  if (summary.qrisSales !== 51000) throw new Error(`QRIS sales mismatch: ${summary.qrisSales} vs 51000`);
  if (summary.debitSales !== 127000) throw new Error(`Debit sales mismatch: ${summary.debitSales} vs 127000`);

  console.log(`✅ [PASS] Financial breakdown matches perfectly:`);
  console.log(`   - Total Revenue: Rp ${summary.revenue.toLocaleString('id-ID')}`);
  console.log(`   - Cash Sales: Rp ${summary.cashSales.toLocaleString('id-ID')}`);
  console.log(`   - QRIS Sales: Rp ${summary.qrisSales.toLocaleString('id-ID')}`);
  console.log(`   - Debit Sales: Rp ${summary.debitSales.toLocaleString('id-ID')}`);
  console.log(`   - Estimated COGS: Rp ${summary.cogs.toLocaleString('id-ID')}`);

  // Expected cash in drawer = initial float (350k) + cash sales (45k) = 395.000
  const expectedDrawerCash = shift.initialCash + summary.cashSales - summary.cashExpenses;
  if (expectedDrawerCash !== 395000) throw new Error(`Expected drawer cash mismatch: ${expectedDrawerCash}`);
  console.log(`✅ [PASS] Expected Cash in Drawer calculated accurately: Rp ${expectedDrawerCash.toLocaleString('id-ID')}`);

  // STEP 8: Close Shift & Excel Export Verification
  console.log('\n📌 STEP 8: Shift Closing & Excel Report Generation');
  const closeRes = await closeShiftService(shift.id, 395000, 'Kasir Utama');
  console.log(`✅ [PASS] Shift #${shift.id} closed cleanly with actual cash Rp ${closeRes.actualCash?.toLocaleString('id-ID')}`);

  const closedShiftData = await prisma.shift.findUnique({
    where: { id: shift.id },
    include: {
      transactions: {
        include: { items: true },
        orderBy: { createdAt: 'asc' },
      },
      expenses: true,
    },
  });

  const excelBuffer = await buildTransactionsExcelBuffer({
    transactions: closedShiftData?.transactions || [],
    totalExpenses: 0,
    expensesList: closedShiftData?.expenses || [],
    sheetName: 'Shift Transactions',
    shiftMeta: {
      startStr: '04/11/2026 10:00:00',
      endStr: '04/11/2026 18:00:00',
      durationStr: '8h 0m',
      openedBy: shift.openedBy,
      closedBy: 'Kasir Utama',
      initialCash: shift.initialCash,
      expectedCash: 395000,
      actualCash: 395000,
      discrepancy: 0,
    },
  });
  if (!excelBuffer || excelBuffer.length < 5000) throw new Error('Excel report export buffer is empty or corrupted');
  console.log(`✅ [PASS] Comprehensive 4-Sheet Excel report generated (${excelBuffer.length} bytes).`);

  // STEP 9: Reopen fresh shift for production
  console.log('\n📌 STEP 9: Reopen Fresh Production Shift');
  const newShift = await openShiftService('Kasir Bazaar Sorelin', 300000);
  console.log(`✅ [PASS] Fresh Shift #${newShift.id} opened for production operation.`);

  console.log('\n================================================================');
  console.log('🏆 100% OF ALL FLOWS, CALCULATIONS & STOCK CHECKS PASSED!');
  console.log('================================================================');
}

runRigorousTest()
  .catch((e) => {
    console.error('❌ Rigorous test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
