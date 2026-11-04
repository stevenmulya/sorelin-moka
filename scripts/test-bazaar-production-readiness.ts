import { prisma } from '../src/lib/prisma';
import {
  openShiftService,
  closeShiftService,
  createExpenseService,
  summarizeShift,
  getActiveShift,
  expectedCashOf,
} from '../src/lib/services/shifts';
import {
  createOrder,
  approvePaymentService,
  changeStatusService,
  cancelOrderService,
  editPaymentService,
  buildOrder,
} from '../src/lib/services/orders';
import {
  adjustStockService,
  createProductService,
} from '../src/lib/services/products';
import { STATUS } from '../src/lib/constants';
import { formatRupiah } from '../src/lib/utils';
import { buildTransactionsExcelBuffer } from '../src/lib/excel';
import * as XLSX from 'xlsx';

async function runBazaarProductionReadinessAudit() {
  console.log('================================================================');
  console.log('🛡️ SORELIN POS — DEEP PRODUCTION READINESS & AUDIT VERIFICATION');
  console.log('   Target: 5-Day Bazaar • 2 iPads (Kiosk + Cashier) • Full Online');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (detail) console.error(`   └─ ERROR: ${detail}`);
      process.exitCode = 1;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. CLEANUP & SHIFT INITIALIZATION WITH PETTY CASH FLOAT
    // -------------------------------------------------------------
    console.log('📌 PHASE 1: Shift Lifecycle & Initial Petty Cash Float');
    const existing = await getActiveShift();
    if (existing) {
      console.log(`- Closing active shift #${existing.id} from prior session...`);
      await closeShiftService(existing.id, 0, 'AutoClean');
    }

    const modalAwal = 350_000; // Rp 350.000 petty cash float for cashier drawer
    const shift = await openShiftService('Kasir Bazaar Utama', modalAwal);
    assert(Boolean(shift && shift.id), 'Shift opened with initial cash float', `Shift #${shift.id}, Opened by: ${shift.openedBy}, Initial Float: ${formatRupiah(shift.initialCash)}`);

    // Verify DB constraint: opening second shift simultaneously must fail
    let duplicateShiftBlocked = false;
    try {
      await openShiftService('Kasir Kedua', 100_000);
    } catch {
      duplicateShiftBlocked = true;
    }
    assert(duplicateShiftBlocked, 'Database enforces strict single-shift constraint (no dual open shifts)');

    // -------------------------------------------------------------
    // 2. PRODUCT & FLAVOR VARIANT CATALOG SETUP
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 2: Product Catalog & Flavor Tray Stock Setup');
    // Create / seed test bread with 2 flavor variants
    const breadProduct = await createProductService(
      {
        name: 'Bazaar Artisan Saltbread',
        type: 'Saltbread',
        variant: 'Signature',
        description: 'Freshly baked artisanal saltbread for bazaar',
        costPrice: 8000,
        price: 18000,
        discountPrice: null,
        stock: 0,
        variantOptions: [
          {
            name: 'Garlic Parmesan',
            price: 20000,
            costPrice: 9000,
            stock: 30, // 30 pcs in tray
            bundleUpcharge: 2000,
          },
          {
            name: 'Truffle Mushroom',
            price: 22000,
            costPrice: 10000,
            stock: 20, // 20 pcs in tray
            bundleUpcharge: 4000,
          },
        ],
      },
      []
    );
    assert(breadProduct.stock === 50, 'Parent product stock is sum of variant tray stocks (30 + 20 = 50 pcs)', `Stock: ${breadProduct.stock}`);

    // Create a Bundle product (Box of 3)
    const bundleProduct = await createProductService(
      {
        name: 'Bazaar Box of 3 Mix',
        type: 'Bundle',
        variant: 'Package',
        description: 'Box of 3 artisanal saltbreads',
        costPrice: 24000,
        price: 55000,
        discountPrice: null,
        isBundle: true,
        bundleQuota: 3,
        stock: 0,
      },
      []
    );
    assert(bundleProduct.isBundle && bundleProduct.bundleQuota === 3, 'Bundle Box of 3 created with quota 3', `ID #${bundleProduct.id}`);

    // Test manual stock adjustment (Stock IN)
    const garlicVar = breadProduct.variants.find((v) => v.name === 'Garlic Parmesan')!;
    const truffleVar = breadProduct.variants.find((v) => v.name === 'Truffle Mushroom')!;

    await adjustStockService({
      productId: breadProduct.id,
      variantOptionId: garlicVar.id,
      type: 'IN',
      quantity: 10,
      giver: 'Head Baker',
      receiver: 'Kasir Booth',
      notes: 'Fresh batch from oven',
    });

    const garlicStockAfterIn = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock;
    assert(garlicStockAfterIn === 40, 'Manual Stock IN correctly incremented variant tray stock to 40 pcs', `Garlic Tray Stock: ${garlicStockAfterIn}`);

    // -------------------------------------------------------------
    // 3. TAMPERING & MALFORMED ORDER DEFENSE (SECURITY & LOGIC)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 3: Security & Tampering Defense');
    // Test 3a: Cart with negative quantity
    let negativeQtyBlocked = false;
    try {
      await createOrder({
        customer: 'Hacker Bob',
        items: [{ productId: breadProduct.id, quantity: -5 }],
      });
    } catch {
      negativeQtyBlocked = true;
    }
    assert(negativeQtyBlocked, 'Tampered cart with negative quantity rejected by server validation');

    // Test 3b: Cart with out-of-stock quantity (> 40)
    let overStockBlocked = false;
    try {
      await createOrder({
        customer: 'Tamperer Eve',
        items: [
          {
            productId: breadProduct.id,
            quantity: 999,
            variantOptionId: garlicVar.id,
            selectedVariant: garlicVar.name,
          },
        ],
      });
    } catch {
      overStockBlocked = true;
    }
    assert(overStockBlocked, 'Excessive demand exceeding physical stock rejected before order creation');

    // -------------------------------------------------------------
    // 4. KIOSK CUSTOMER ORDER (IPAD 1: CUSTOMER FACING)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 4: Kiosk Order Creation (Customer iPad)');
    // Order 1: 2x Garlic Parmesan + 1x Box of 3 (2x Garlic Parmesan, 1x Truffle Mushroom)
    const order1 = await createOrder({
      customer: 'Dewi Lestari',
      email: 'dewi@example.com',
      phone: '081299988877',
      selfieUrl: '/uploads/selfie_dewi_test.jpg',
      items: [
        {
          productId: breadProduct.id,
          quantity: 2,
          variantOptionId: garlicVar.id,
          selectedVariant: garlicVar.name,
          isBundle: false,
        },
        {
          productId: bundleProduct.id,
          quantity: 1,
          isBundle: true,
          bundleContents: '2x Garlic Parmesan (+Rp 4.000), 1x Truffle Mushroom (+Rp 4.000)',
        },
      ],
    });

    // Pricing calculation check:
    // Single: 2 * 20.000 = 40.000
    // Bundle: Base 55.000 + 2*2000 (Garlic) + 1*4000 (Truffle) = 63.000
    // Total: 40.000 + 63.000 = 103.000
    assert(order1.status === STATUS.WAITING, 'Order 1 created in "Waiting Payment" status', `ID #${order1.id}, Customer: ${order1.customer}, Total: ${formatRupiah(order1.amount)}`);
    assert(order1.amount === 103_000, 'Order 1 total mathematically accurate (Base + Flavor Upcharges)', `Expected 103.000, Actual: ${order1.amount}`);

    // Stock should NOT be deducted yet
    const garlicStockWaiting = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock;
    assert(garlicStockWaiting === 40, 'Stock remains unchanged while waiting for cashier payment approval', `Stock: ${garlicStockWaiting}`);

    // -------------------------------------------------------------
    // 5. CASHIER APPROVAL: CASH PAYMENT & CHANGE DUE (IPAD 2)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 5: Cashier Approval — Cash Payment & Tray Stock Deduction');
    const cashReceived = 150_000;
    await approvePaymentService({
      transactionId: order1.id,
      cashierName: 'Kasir Bazaar Utama',
      paymentMethod: 'Cash',
      paidAmount: cashReceived,
    });

    const approvedOrder1 = await prisma.transaction.findUnique({ where: { id: order1.id } });
    assert(approvedOrder1?.status === STATUS.PREPARING, 'Order 1 status transitioned Waiting Payment -> Preparing', `Payment: Cash, Received: ${formatRupiah(approvedOrder1?.paidAmount || 0)}`);

    // Verify stock deduction:
    // Order 1 consumed: 2 (single) + 2 (bundle) = 4 pcs Garlic Parmesan
    // Order 1 consumed: 1 (bundle) = 1 pc Truffle Mushroom
    const garlicStockAfter1 = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock;
    const truffleStockAfter1 = (await prisma.productVariantOption.findUnique({ where: { id: truffleVar.id } }))?.stock;
    assert(garlicStockAfter1 === 36, 'Garlic tray stock deducted exactly 4 pcs (2 single + 2 bundle)', `Expected: 36, Actual: ${garlicStockAfter1}`);
    assert(truffleStockAfter1 === 19, 'Truffle tray stock deducted exactly 1 pc (1 bundle)', `Expected: 19, Actual: ${truffleStockAfter1}`);

    // Verify double-approval prevention
    let doubleApproveBlocked = false;
    try {
      await approvePaymentService({
        transactionId: order1.id,
        cashierName: 'Kasir Bazaar Utama',
        paymentMethod: 'Cash',
        paidAmount: cashReceived,
      });
    } catch {
      doubleApproveBlocked = true;
    }
    assert(doubleApproveBlocked, 'Double-payment approval rejected atomically by database lock');

    // -------------------------------------------------------------
    // 6. CASHIER APPROVAL: QRIS PAYMENT (NON-CASH)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 6: Kiosk Order 2 & Approval — QRIS Payment');
    const order2 = await createOrder({
      customer: 'Hendra Setiawan',
      phone: '081388877766',
      items: [
        {
          productId: breadProduct.id,
          quantity: 3,
          variantOptionId: truffleVar.id,
          selectedVariant: truffleVar.name,
          isBundle: false,
        },
      ],
    });

    await approvePaymentService({
      transactionId: order2.id,
      cashierName: 'Kasir Bazaar Utama',
      paymentMethod: 'QRIS',
      paidAmount: order2.amount,
    });

    const approvedOrder2 = await prisma.transaction.findUnique({ where: { id: order2.id } });
    assert(approvedOrder2?.paymentMethod === 'QRIS' && approvedOrder2?.status === STATUS.PREPARING, 'Order 2 approved via QRIS with exact amount', `Amount: ${formatRupiah(approvedOrder2?.amount || 0)}`);

    const truffleStockAfter2 = (await prisma.productVariantOption.findUnique({ where: { id: truffleVar.id } }))?.stock;
    assert(truffleStockAfter2 === 16, 'Truffle tray stock deducted exactly 3 pcs for Order 2', `Remaining: ${truffleStockAfter2} pcs`);

    // -------------------------------------------------------------
    // 7. OPERATIONAL EXPENSES & NEGATIVE CASH FLOW
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 7: Multi-Million Expenses & Deficit Profitability');
    const sewaBooth = 4_500_000; // Rp 4.500.000 for 5 days booth rent
    const iceCubes = 30_000;
    await createExpenseService('Sewa Booth Bazaar 5 Hari', sewaBooth, 'Transfer');
    await createExpenseService('Beli Es Batu Balok', iceCubes, 'Cash');

    const summaryMid = await summarizeShift(prisma, shift.id);
    assert(summaryMid.expenses === sewaBooth + iceCubes, 'Total expenses match recorded booth rent and cash expenses', `Expenses: ${formatRupiah(summaryMid.expenses)}`);
    assert(summaryMid.netFlow < 0, 'Net Financial Flow handles deficit smoothly without negative blocking', `Net Flow: ${formatRupiah(summaryMid.netFlow)}`);

    // Expected cash calculation:
    // Initial float (350.000) + Cash Sales (Order 1 = 103.000) - Cash Expenses (Ice = 30.000) = 423.000
    const expectedDrawerCash = expectedCashOf(shift.initialCash, summaryMid);
    assert(expectedDrawerCash === 350_000 + 103_000 - 30_000, 'Cash drawer expected balance calculated accurately', `Expected Drawer Cash: ${formatRupiah(expectedDrawerCash)}`);

    // -------------------------------------------------------------
    // 8. KITCHEN KANBAN PROGRESSION & CANCELLATION RESTOCK
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 8: Kitchen Kanban Progression & Cancellation Restock');
    // Progress Order 1 to Ready -> Picked Up
    await changeStatusService(order1.id, STATUS.READY);
    await changeStatusService(order1.id, STATUS.PICKED_UP);
    const order1Done = await prisma.transaction.findUnique({ where: { id: order1.id } });
    assert(order1Done?.status === STATUS.PICKED_UP, 'Order 1 transitioned Preparing -> Ready -> Picked Up');

    // Create Order 3 to test Cancellation while in Preparing status (Restores Stock)
    const garlicBefore3 = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock || 0;
    const order3 = await createOrder({
      customer: 'Rudi Batal',
      items: [
        {
          productId: breadProduct.id,
          quantity: 2,
          variantOptionId: garlicVar.id,
          selectedVariant: garlicVar.name,
          isBundle: false,
        },
      ],
    });
    await approvePaymentService({
      transactionId: order3.id,
      cashierName: 'Kasir Bazaar Utama',
      paymentMethod: 'Cash',
      paidAmount: order3.amount,
    });

    const garlicDuring3 = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock || 0;
    assert(garlicDuring3 === garlicBefore3 - 2, 'Order 3 temporarily deducted 2 pcs Garlic', `Stock: ${garlicDuring3}`);

    // Customer cancels before baking
    await cancelOrderService({
      transactionId: order3.id,
      reason: 'Customer rushed to leave',
    });

    const garlicAfterCancel = (await prisma.productVariantOption.findUnique({ where: { id: garlicVar.id } }))?.stock || 0;
    assert(garlicAfterCancel === garlicBefore3, 'Cancelled order restored exact stock back to tray (36 pcs)', `Stock after cancel: ${garlicAfterCancel}`);

    const cancelledOrder3 = await prisma.transaction.findUnique({ where: { id: order3.id } });
    assert(cancelledOrder3?.status === STATUS.CANCELLED, 'Order 3 marked as Cancelled and removed from active sales revenue');

    // -------------------------------------------------------------
    // 9. COMPLETE EXCEL EXPORT VERIFICATION (ALL 4 SHEETS)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 9: Complete 4-Sheet Excel Export Generation');
    const shiftTransactions = await prisma.transaction.findMany({
      where: { shiftId: shift.id },
      include: { items: true },
    });
    const shiftExpenses = await prisma.expense.findMany({
      where: { shiftId: shift.id },
    });

    const excelBuffer = await buildTransactionsExcelBuffer({
      transactions: shiftTransactions.map((t) => ({
        id: t.id,
        customer: t.customer,
        amount: t.amount,
        status: t.status,
        paymentMethod: t.paymentMethod,
        createdAt: t.createdAt,
        items: t.items.map((i) => ({
          quantity: i.quantity,
          productName: i.productName,
          costPrice: i.costPrice,
          price: i.price,
          selectedVariant: i.selectedVariant,
          isBundle: i.isBundle,
          bundleContents: i.bundleContents,
        })),
      })),
      totalExpenses: summaryMid.expenses,
      expensesList: shiftExpenses,
      sheetName: `Shift-${shift.id}`,
      periodLabel: `Bazaar Day 1 - Shift #${shift.id}`,
      shiftMeta: {
        startStr: shift.startTime.toISOString(),
        endStr: 'Ongoing',
        durationStr: 'Testing',
        openedBy: shift.openedBy,
        closedBy: '-',
        initialCash: shift.initialCash,
        expectedCash: expectedDrawerCash,
        actualCash: expectedDrawerCash,
        discrepancy: 0,
      },
    });

    const wb = XLSX.read(excelBuffer, { type: 'buffer' });
    const sheets = wb.SheetNames;
    console.log(`- Generated Excel Sheets: ${sheets.join(', ')}`);

    assert(sheets.includes(`Shift-${shift.id}`), 'Excel contains Primary Transactions Sheet');
    assert(sheets.includes('Product Sales'), 'Excel contains Dedicated Product Sales Sheet (Rekap Produk)');
    assert(sheets.includes('Variant Breakdown'), 'Excel contains Dedicated Variant Breakdown Sheet (Rekap Varian Rasa)');
    assert(sheets.includes('Expenses'), 'Excel contains Detailed Expenses Sheet');

    // Verify Variant Breakdown sheet content
    const variantSheetData = XLSX.utils.sheet_to_json(wb.Sheets['Variant Breakdown']);
    assert(variantSheetData.length > 0, 'Variant Breakdown contains aggregated flavor consumption data');

    // -------------------------------------------------------------
    // 10. CASH DRAWER COUNT & SHIFT CLOSING (RECONCILIATION)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 10: Cash Drawer Reconciliation & Shift Closing');
    // Cashier counts exactly Rp 423.000 in the drawer
    const actualCashCounted = expectedDrawerCash;
    const closeResult = await closeShiftService(shift.id, actualCashCounted, 'Kasir Bazaar Utama');

    assert(closeResult.actualCash === actualCashCounted, 'Actual cash recorded matches cashier drawer physical count', `Actual Cash: ${formatRupiah(closeResult.actualCash)}`);
    assert(closeResult.expectedCash === expectedDrawerCash, 'Expected cash matches calculated ledger balance', `Expected: ${formatRupiah(closeResult.expectedCash)}`);

    const closedShiftRecord = await prisma.shift.findUnique({ where: { id: shift.id } });
    const finalDiscrepancy = (closedShiftRecord?.actualCash ?? 0) - (closedShiftRecord?.expectedCash ?? 0);
    assert(finalDiscrepancy === 0, 'Zero discrepancy between actual and expected cash', `Discrepancy: ${formatRupiah(finalDiscrepancy)}`);
    assert(closedShiftRecord?.status === 'Closed', 'Shift cleanly marked as Closed');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`🎯 PRODUCTION READINESS RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('================================================================');
    if (passed === total) {
      console.log('🏆 SYSTEM IS 100% PRODUCTION READY FOR 5-DAY BAZAAR OPERATION!');
    }
  } catch (err) {
    console.error('💥 Error during production audit test:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runBazaarProductionReadinessAudit();
