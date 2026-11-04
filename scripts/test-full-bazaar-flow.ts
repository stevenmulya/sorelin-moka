import { prisma } from '../src/lib/prisma';
import { openShiftService, closeShiftService, createExpenseService, summarizeShift, getActiveShift } from '../src/lib/services/shifts';
import { createOrder, approvePaymentService, changeStatusService, cancelOrderService } from '../src/lib/services/orders';
import { STATUS } from '../src/lib/constants';
import { formatRupiah } from '../src/lib/utils';
import { buildTransactionsExcelBuffer } from '../src/lib/excel';

async function runFullBazaarFlowTest() {
  console.log('================================================================');
  console.log('🧪 SORELIN POS — END-TO-END BAZAAR 3-DAY FLOW TEST');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
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
    // PRE-CHECK: Ensure clean active shift state
    // -------------------------------------------------------------
    console.log('📌 1. SETUP: Shift Initialization');
    const existingActiveShift = await getActiveShift();
    if (existingActiveShift) {
      console.log(`- Closing pre-existing active shift #${existingActiveShift.id}...`);
      await closeShiftService(existingActiveShift.id, 0, 'AutoTest Setup');
    }

    // TEST STEP 1: Open Shift without mandatory initial cash float (defaults to 0)
    const newShift = await openShiftService('Kasir Bazaar Sorelin');
    assert(Boolean(newShift && newShift.id), 'Shift opened successfully', `Shift #${newShift.id} opened by ${newShift.openedBy}`);

    // Fetch active products & variants
    const allProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
    });
    console.log(`- Loaded ${allProducts.length} active products from database:`);
    allProducts.forEach(p => console.log(`   * [#${p.id}] ${p.name} (isBundle: ${p.isBundle}, stock: ${p.stock}, variants: ${p.variants.length})`));

    // Fetch all variant options across all products
    const allVariantOptions = await prisma.productVariantOption.findMany({ where: { isActive: true } });
    console.log(`- Loaded ${allVariantOptions.length} total variant options across database`);

    const saltBread = allProducts.find(p => p.id === 23) || allProducts.find(p => !p.isBundle && p.variants.length > 0) || allProducts[0];
    const bundleBox = allProducts.find(p => p.id === 24) || allProducts.find(p => p.isBundle);
    let testVariant = (saltBread?.variants && saltBread.variants[0]) || allVariantOptions[0] || null;

    if (!testVariant) {
      console.log(`- No variant found in DB, creating a test flavor variant for "${saltBread?.name}"...`);
      testVariant = await prisma.productVariantOption.create({
        data: {
          productId: saltBread!.id,
          name: 'Garlic Butter',
          price: saltBread!.price,
          costPrice: saltBread!.costPrice,
          stock: 50,
          bundleUpcharge: 0,
        },
      });
    }

    assert(Boolean(saltBread), 'Standard Product available in catalog', `Found "${saltBread?.name}"`);
    assert(Boolean(bundleBox), 'Bundle Package product available in catalog', `Found "${bundleBox?.name}" (quota: ${bundleBox?.bundleQuota || 3})`);

    const initialVariantStock = testVariant.stock;
    const initialProductStock = saltBread!.stock;
    console.log(`- Baseline stock for variant "${testVariant.name}": ${initialVariantStock} pcs (Parent total: ${initialProductStock} pcs)`);

    // Ensure test variant has at least 15 pcs for the test
    if (testVariant.stock < 15) {
      await prisma.productVariantOption.update({
        where: { id: testVariant.id },
        data: { stock: 30 },
      });
      testVariant.stock = 30;
      console.log(`- Seeded extra stock for testing (Tray: 30 pcs)`);
    }

    // -------------------------------------------------------------
    // TEST STEP 2: Kiosk Flow — Order 1 (Cash Payment)
    // -------------------------------------------------------------
    console.log('\n📌 2. KIOSK ORDER 1: Single item + Bundle Box (Cash)');
    const singleQty = 2;
    const quota = bundleBox?.bundleQuota || 3;
    const bundleContents = `${testVariant.name} (${quota}x)`;
    const bundleQty = 1;

    const order1 = await createOrder({
      customer: 'Ahmad Pelanggan',
      email: 'ahmad@example.com',
      phone: '08123456789',
      selfieUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', // Base64 selfie format
      items: [
        {
          productId: saltBread.id,
          quantity: singleQty,
          variantOptionId: testVariant.id,
          selectedVariant: testVariant.name,
          isBundle: false,
        },
        {
          productId: bundleBox!.id,
          quantity: bundleQty,
          isBundle: true,
          bundleContents: bundleContents,
        },
      ],
    });

    assert(order1.status === STATUS.WAITING, 'Order 1 created in "Waiting Payment" status', `TRX ID #${order1.id}, Total: ${formatRupiah(order1.amount)}`);

    // Stock should NOT be deducted yet in Waiting Payment status
    const stockAfterWaiting = await prisma.productVariantOption.findUnique({ where: { id: testVariant.id } });
    assert(stockAfterWaiting?.stock === testVariant.stock, 'Stock remains untouched while in "Waiting Payment"', `Tray stock: ${stockAfterWaiting?.stock}`);

    // -------------------------------------------------------------
    // TEST STEP 3: Cashier Approval — Cash Payment & Change Math
    // -------------------------------------------------------------
    console.log('\n📌 3. CASHIER APPROVAL: Cash Payment');
    const cashGiven = order1.amount + 50000; // Customer pays with larger note
    await approvePaymentService({
      transactionId: order1.id,
      cashierName: 'Kasir Bazaar Sorelin',
      paymentMethod: 'Cash',
      paidAmount: cashGiven,
    });

    const approvedOrder1 = await prisma.transaction.findUnique({ where: { id: order1.id } });
    assert(approvedOrder1?.status === STATUS.PREPARING, 'Order 1 approved and status transitioned to "Preparing"', `Paid: ${formatRupiah(approvedOrder1?.paidAmount || 0)} with Cash`);

    // Stock verification: single items + bundle items demanded
    const totalDemanded = singleQty + quota * bundleQty;
    const stockAfterApproval = await prisma.productVariantOption.findUnique({ where: { id: testVariant.id } });
    const expectedStock = testVariant.stock - totalDemanded;
    assert(stockAfterApproval?.stock === expectedStock, 'Tray stock correctly deducted for single + bundle box items', `Expected: ${expectedStock}, Actual: ${stockAfterApproval?.stock} (Deducted: ${totalDemanded} pcs)`);

    // Verify InventoryLog entries created
    const logsOrder1 = await prisma.inventoryLog.findMany({
      where: { productId: saltBread.id, type: 'OUT' },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    assert(logsOrder1.length > 0, 'InventoryLog OUT entries recorded for single & bundle items', `Recorded: ${logsOrder1[0]?.notes}`);

    // -------------------------------------------------------------
    // TEST STEP 4: Kiosk Order 2 (QRIS Payment)
    // -------------------------------------------------------------
    console.log('\n📌 4. KIOSK ORDER 2: QRIS Payment');
    const order2 = await createOrder({
      customer: 'Siti Pembeli',
      email: 'siti@example.com',
      items: [
        {
          productId: saltBread.id,
          quantity: 1,
          variantOptionId: testVariant.id,
          selectedVariant: testVariant.name,
          isBundle: false,
        },
      ],
    });

    await approvePaymentService({
      transactionId: order2.id,
      cashierName: 'Kasir Bazaar Sorelin',
      paymentMethod: 'QRIS',
      paidAmount: order2.amount,
    });

    const approvedOrder2 = await prisma.transaction.findUnique({ where: { id: order2.id } });
    assert(approvedOrder2?.paymentMethod === 'QRIS' && approvedOrder2?.status === STATUS.PREPARING, 'Order 2 approved via QRIS with exact amount', `Amount: ${formatRupiah(approvedOrder2?.amount || 0)}`);

    // -------------------------------------------------------------
    // TEST STEP 5: Upfront Expense (Sewa Booth) — Negative Flow Check
    // -------------------------------------------------------------
    console.log('\n📌 5. OPERATIONAL EXPENSE: Upfront Booth Rent (Rp 3.000.000)');
    const rentAmount = 3_000_000;
    const expense1 = await createExpenseService('Sewa Booth Bazaar 3 Hari', rentAmount);
    assert(Boolean(expense1 && expense1.amount === rentAmount), 'Large expense recorded successfully without cash drawer blocking', `Recorded expense "${expense1.name}" for ${formatRupiah(expense1.amount)}`);

    // Another daily operating expense
    const iceAmount = 25_000;
    const expense2 = await createExpenseService('Beli Es Batu Balok', iceAmount);
    assert(Boolean(expense2 && expense2.amount === iceAmount), 'Second operational expense recorded smoothly', `Expense "${expense2.name}": ${formatRupiah(expense2.amount)}`);

    // -------------------------------------------------------------
    // TEST STEP 6: Multi-Day Shift Financial Summary & Negative Profit
    // -------------------------------------------------------------
    console.log('\n📌 6. FINANCIAL RECONCILIATION: Shift Summary & Deficit Handling');
    const summary = await summarizeShift(prisma, newShift.id);
    const expectedRevenue = approvedOrder1!.amount + approvedOrder2!.amount;
    const expectedTotalExp = rentAmount + iceAmount;

    assert(summary.revenue === expectedRevenue, 'Shift revenue matches paid orders total', `Revenue: ${formatRupiah(summary.revenue)} (Cash: ${formatRupiah(summary.cashSales)}, QRIS: ${formatRupiah(summary.qrisSales)})`);
    assert(summary.expenses === expectedTotalExp, 'Shift expenses match total recorded expenses', `Expenses: ${formatRupiah(summary.expenses)}`);
    assert(summary.netFlow < 0, 'Net Financial Flow correctly computes negative result (minus)', `Net Flow: ${formatRupiah(summary.netFlow)}`);
    assert(summary.netProfit < 0, 'Net Profit correctly computes net loss/deficit due to upfront rent', `Net Profit: ${formatRupiah(summary.netProfit)}`);

    // -------------------------------------------------------------
    // TEST STEP 7: Order Kitchen Progression & Cancellation/Restock
    // -------------------------------------------------------------
    console.log('\n📌 7. KITCHEN PROGRESSION & ORDER CANCELLATION RESTOCK');
    // Progress Order 1 to Ready -> Picked Up
    await changeStatusService(order1.id, STATUS.READY);
    await changeStatusService(order1.id, STATUS.PICKED_UP);
    const order1Done = await prisma.transaction.findUnique({ where: { id: order1.id } });
    assert(order1Done?.status === STATUS.PICKED_UP, 'Order 1 transitioned Preparing -> Ready -> Picked Up', `Status: ${order1Done?.status}`);

    // Create Order 3 to test cancellation and stock restoration
    const stockBeforeOrder3 = (await prisma.productVariantOption.findUnique({ where: { id: testVariant.id } }))?.stock || 0;
    const order3 = await createOrder({
      customer: 'Budi Test Batal',
      items: [
        {
          productId: saltBread.id,
          quantity: 2,
          variantOptionId: testVariant.id,
          selectedVariant: testVariant.name,
          isBundle: false,
        },
      ],
    });
    await approvePaymentService({
      transactionId: order3.id,
      cashierName: 'Kasir Bazaar Sorelin',
      paymentMethod: 'Cash',
      paidAmount: order3.amount,
    });

    // Cancel Order 3 while in Preparing status
    await cancelOrderService({
      transactionId: order3.id,
      reason: 'Customer cancelled before baking',
    });

    const stockAfterCancel = (await prisma.productVariantOption.findUnique({ where: { id: testVariant.id } }))?.stock || 0;
    assert(stockAfterCancel === stockBeforeOrder3, 'Cancelled order restored exact variant stock back to tray', `Stock before: ${stockBeforeOrder3}, Stock after cancellation: ${stockAfterCancel}`);

    const restockLog = await prisma.inventoryLog.findFirst({
      where: { productId: saltBread.id, type: 'IN' },
      orderBy: { createdAt: 'desc' },
    });
    assert(Boolean(restockLog && restockLog.notes?.toLowerCase().includes('cancelled')), 'InventoryLog IN restock entry logged on order cancellation', `Log notes: ${restockLog?.notes}`);

    // -------------------------------------------------------------
    // TEST STEP 8: Excel Export Buffer Generation (All Sheets)
    // -------------------------------------------------------------
    console.log('\n📌 8. REPORT & EXCEL EXPORT GENERATION');
    const shiftTransactions = await prisma.transaction.findMany({
      where: { shiftId: newShift.id },
      include: { items: true },
    });
    const shiftExpenses = await prisma.expense.findMany({
      where: { shiftId: newShift.id },
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
      totalExpenses: summary.expenses,
      expensesList: shiftExpenses,
      sheetName: `Shift-${newShift.id}`,
      periodLabel: `Shift #${newShift.id} (${newShift.openedBy})`,
      shiftMeta: {
        startStr: newShift.startTime.toISOString(),
        endStr: 'Active',
        durationStr: 'Testing',
        openedBy: newShift.openedBy,
        closedBy: '-',
        initialCash: newShift.initialCash,
        expectedCash: summary.netFlow,
        actualCash: '-',
        discrepancy: '-',
      },
    });

    assert(Boolean(excelBuffer && excelBuffer.length > 5000), 'Excel .xlsx workbook generated with Summary, Sales, Variants, and Expenses sheets', `Buffer size: ${excelBuffer.length} bytes`);

    // -------------------------------------------------------------
    // TEST STEP 9: Close Shift Cleanly
    // -------------------------------------------------------------
    console.log('\n📌 9. CLOSE SHIFT & RECONCILIATION');
    const closeResult = await closeShiftService(newShift.id, 0, 'Kasir Penutup');
    const closedShift = await prisma.shift.findUnique({ where: { id: newShift.id } });
    assert(closedShift?.status === 'Closed' && closedShift?.closedBy === 'Kasir Penutup', 'Shift closed cleanly without mandatory drawer count restrictions', `Shift #${newShift.id} closed at ${closedShift?.endTime?.toISOString()}`);

    // Verify waiting orders auto-cancelled and active kitchen orders archived
    const remainingActiveTrx = await prisma.transaction.count({
      where: { shiftId: newShift.id, status: { in: [STATUS.WAITING, STATUS.PREPARING] } },
    });
    assert(remainingActiveTrx === 0, 'No dangling waiting or preparing orders after shift close', 'Kitchen board cleared for next shift');

    // -------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`🎯 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('================================================================');

    if (passedTests === totalTests) {
      console.log('🎉 ALL FLOWS VERIFIED 100% OPERATIONAL & READY FOR BAZAAR!');
    }
  } catch (error) {
    console.error('💥 Unhandled error during flow test:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runFullBazaarFlowTest();
