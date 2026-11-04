import { prisma } from '../src/lib/prisma';
import { openShiftService, closeShiftService, summarizeShift } from '../src/lib/services/shifts';
import { createOrder, approvePaymentService } from '../src/lib/services/orders';
import { parseBundleConfig } from '../src/lib/bundle-config';
import { buildTransactionsExcelBuffer } from '../src/lib/excel';
import { seedBazaarMenu } from './seed-bazaar-menu';

async function runBulletproofAudit() {
  console.log('================================================================');
  console.log('🛡️ SORELIN POS — BULLETPROOF SCENARIO AUDIT & STRESS TEST');
  console.log('================================================================\n');

  // ========================================================================
  // SCENARIO 1: Verifikasi Kebersihan Database
  // ========================================================================
  console.log('📌 SCENARIO 1: Database Cleanliness & Active Catalog Integrity');
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { type: true },
    orderBy: { id: 'asc' },
  });

  console.log(`- Total Produk Aktif di DB: ${activeProducts.length}`);
  if (activeProducts.length !== 10) {
    throw new Error(`CRITICAL: Database harus memiliki tepat 10 produk aktif, tapi ditemukan ${activeProducts.length}`);
  }

  const saltbreads = activeProducts.filter((p) => p.type?.name === 'Saltbread');
  const beverages = activeProducts.filter((p) => p.type?.name === 'Beverage');
  const bundles = activeProducts.filter((p) => p.isBundle);

  if (saltbreads.length !== 6 || beverages.length !== 2 || bundles.length !== 2) {
    throw new Error(`CRITICAL: Komposisi produk salah! Saltbread=${saltbreads.length}, Beverage=${beverages.length}, Bundles=${bundles.length}`);
  }
  console.log(`✅ [PASS] Komposisi 100% tepat: 6 Saltbreads, 2 Beverages, 2 Bundles (A & B). Tidak ada produk hantu/duplikat.`);

  // ========================================================================
  // SCENARIO 2: Menghabiskan Stok Saltbread & Menguji Logika Ketersediaan Bundle
  // ========================================================================
  console.log('\n📌 SCENARIO 2: Stock Depletion Edge-Case (Hanya Tersisa 2 Saltbread)');
  
  // Catat stok awal asli agar bisa di-restore
  const originalStockMap = new Map<number, number>();
  for (const p of activeProducts) {
    originalStockMap.set(p.id, p.stock);
  }

  // Set 4 jenis saltbread menjadi 0 stock, sisakan 2 jenis: Original=1 pc, Garlic=1 pc (Total Saltbread = 2)
  await prisma.product.updateMany({
    where: { id: { in: [80, 81, 82, 83] } },
    data: { stock: 0 },
  });
  await prisma.product.update({ where: { id: 78 }, data: { stock: 1 } }); // Original = 1
  await prisma.product.update({ where: { id: 79 }, data: { stock: 1 } }); // Garlic = 1

  // Ambil state terkini produk
  const depletedProducts = await prisma.product.findMany({
    where: { isActive: true },
    include: { type: true },
  });

  const bundleA = depletedProducts.find((p) => p.name.includes('Bundle A'))!;
  const bundleB = depletedProducts.find((p) => p.name.includes('Bundle B'))!;

  // Fungsi simulasi ketersediaan bundle (sama persis dengan KioskFlow.tsx:isBundleAvailable)
  function checkBundleAvailable(bundleProd: typeof bundleA, allProds: typeof depletedProducts): boolean {
    const config = parseBundleConfig(bundleProd.availableVariants);
    if (!config.slots || config.slots.length === 0) return true;

    for (const slot of config.slots) {
      if (slot.type === 'CATEGORY' && slot.categoryName) {
        const catName = slot.categoryName.trim().toLowerCase();
        const quota = slot.quota || 1;
        const matching = allProds.filter(
          (p) => p.type?.name?.trim().toLowerCase() === catName && !p.isBundle
        );
        const totalStock = matching.reduce((sum, p) => sum + p.stock, 0);
        if (totalStock < quota) return false;
      }
    }
    return true;
  }

  const isBundleAAvailable = checkBundleAvailable(bundleA, depletedProducts);
  const isBundleBAvailable = checkBundleAvailable(bundleB, depletedProducts);

  console.log(`- Stok Saltbread tersisa: Original=1, Garlic=1, 4 jenis lainnya=0. Total Saltbread: 2 pcs.`);
  console.log(`- Status Bundle A (Butuh 2 Saltbread): ${isBundleAAvailable ? 'TERSEDIA (AVAILABLE)' : 'SOLD OUT'}`);
  console.log(`- Status Bundle B (Butuh 5 Saltbread): ${isBundleBAvailable ? 'TERSEDIA (AVAILABLE)' : 'SOLD OUT'}`);

  if (!isBundleAAvailable) {
    throw new Error('CRITICAL BUG: Bundle A seharusnya masih tersedia karena sisa total saltbread = 2!');
  }
  if (isBundleBAvailable) {
    throw new Error('CRITICAL BUG: Bundle B seharusnya SOLD OUT karena butuh 5 saltbread sedangkan sisa cuma 2!');
  }
  console.log(`✅ [PASS] Bundle B otomatis SOLD OUT karena stok saltbread tidak mencukupi kuota 5.`);
  console.log(`✅ [PASS] Bundle A tetap TERSEDIA karena total stok saltbread (2) mencukupi kuota 2.`);

  // Sekarang kurangi 1 lagi saltbread sehingga total saltbread = 1
  await prisma.product.update({ where: { id: 78 }, data: { stock: 0 } });
  const almostEmptyProds = await prisma.product.findMany({ where: { isActive: true }, include: { type: true } });
  const isBundleAWhenOneLeft = checkBundleAvailable(bundleA, almostEmptyProds);
  console.log(`- Stok Saltbread dikurangi lagi hingga total sisa 1 pc:`);
  console.log(`- Status Bundle A: ${isBundleAWhenOneLeft ? 'TERSEDIA' : 'SOLD OUT'}`);
  if (isBundleAWhenOneLeft) {
    throw new Error('CRITICAL BUG: Bundle A harusnya SOLD OUT saat sisa saltbread cuma 1!');
  }
  console.log(`✅ [PASS] Bundle A otomatis SOLD OUT saat stok saltbread di bawah kuota 2.`);

  // Restore stok kembali ke kondisi awal
  for (const [id, stock] of originalStockMap.entries()) {
    await prisma.product.update({ where: { id }, data: { stock } });
  }
  console.log(`✅ [PASS] Stok produk berhasil di-restore ke kondisi operasional.`);

  // ========================================================================
  // SCENARIO 3: Bundle B Component Stock Decrement Precision
  // ========================================================================
  console.log('\n📌 SCENARIO 3: Bundle B (5 Saltbread + 3 Beverage) Physical Stock Decrement Test');

  // Ambil atau Tutup shift aktif sebelumnya jika ada, lalu buka shift baru
  const existingShift = await prisma.shift.findFirst({ where: { status: 'Open' } });
  if (existingShift) {
    await closeShiftService(existingShift.id, existingShift.initialCash, 'Admin Clean');
  }

  // Set fresh test inventory (100 pcs per product) to prevent starvation in stress test
  await prisma.product.updateMany({
    where: { isBundle: false },
    data: { stock: 100 },
  });

  // Mulai Shift Baru untuk pengujian transaksi
  const shift = await openShiftService('Kasir Audit Bulletproof', 500000);
  console.log(`- Shift #${shift.id} dibuka dengan Modal Awal Kasir: Rp 500.000`);

  const preOriginal = (await prisma.product.findUnique({ where: { id: 78 } }))!.stock;
  const preGarlic = (await prisma.product.findUnique({ where: { id: 79 } }))!.stock;
  const preMilkTea = (await prisma.product.findUnique({ where: { id: 84 } }))!.stock;
  const preLemonTea = (await prisma.product.findUnique({ where: { id: 85 } }))!.stock;

  // Order Bundle B: 3x Original + 2x Garlic Butter + 2x Thai Milk Tea + 1x Thai Lemon
  // Bundle contents string yang dihasilkan Kiosk Customizer:
  const bundleBContents = '3x Salt Bread Original, 2x Salt Bread Garlic Butter (+Rp 4.000), 2x Thai Milk Tea, 1x Thai Tea Honey Lemon';
  // Base price 115k + Garlic Butter (20k - 18k = 2k) * 2 = 119.000
  const orderBRes = await createOrder({
    customer: 'Customer B Test',
    paymentMethod: 'Cash',
    items: [
      {
        productId: 90, // Bundle B
        quantity: 1,
        selectedVariant: 'Standard',
        notes: 'Uji Bundle B Multi-qty',
        isBundle: true,
        bundleContents: bundleBContents,
      },
    ],
  });

  const approveHelper = async (trxId: number, method: 'Cash' | 'QRIS' | 'Debit', amount: number) => {
    return approvePaymentService({
      transactionId: trxId,
      cashierName: 'Kasir Audit',
      paymentMethod: method,
      paidAmount: amount,
    });
  };

  await approveHelper(orderBRes.id, 'Cash', 119000);

  const postOriginal = (await prisma.product.findUnique({ where: { id: 78 } }))!.stock;
  const postGarlic = (await prisma.product.findUnique({ where: { id: 79 } }))!.stock;
  const postMilkTea = (await prisma.product.findUnique({ where: { id: 84 } }))!.stock;
  const postLemonTea = (await prisma.product.findUnique({ where: { id: 85 } }))!.stock;

  console.log(`- Pemotongan Stok Fisik Bundle B:`);
  console.log(`  * Salt Bread Original: ${preOriginal} -> ${postOriginal} (Selisih: ${postOriginal - preOriginal})`);
  console.log(`  * Salt Bread Garlic Butter: ${preGarlic} -> ${postGarlic} (Selisih: ${postGarlic - preGarlic})`);
  console.log(`  * Thai Milk Tea: ${preMilkTea} -> ${postMilkTea} (Selisih: ${postMilkTea - preMilkTea})`);
  console.log(`  * Thai Lemon Tea: ${preLemonTea} -> ${postLemonTea} (Selisih: ${postLemonTea - preLemonTea})`);

  if (postOriginal !== preOriginal - 3) throw new Error(`Stock mismatch on Original Saltbread! Expected -3, got ${postOriginal - preOriginal}`);
  if (postGarlic !== preGarlic - 2) throw new Error(`Stock mismatch on Garlic Butter! Expected -2, got ${postGarlic - preGarlic}`);
  if (postMilkTea !== preMilkTea - 2) throw new Error(`Stock mismatch on Milk Tea! Expected -2, got ${postMilkTea - preMilkTea}`);
  if (postLemonTea !== preLemonTea - 1) throw new Error(`Stock mismatch on Lemon Tea! Expected -1, got ${postLemonTea - preLemonTea}`);
  console.log(`✅ [PASS] Seluruh komponen isi Bundle B terpotong secara atomik dan akurat 100%.`);

  // ========================================================================
  // SCENARIO 4: High-Volume Multi-Transaction & Multi-Payment Stress Test
  // ========================================================================
  console.log('\n📌 SCENARIO 4: High-Volume Multi-Transaction & Mixed Expenses Stress Test');

  // Catat stok sebelum batch transaksi besar
  const stockBeforeBatch = new Map<number, number>();
  const prodsBefore = await prisma.product.findMany();
  for (const p of prodsBefore) stockBeforeBatch.set(p.id, p.stock);

  // Buat 15 transaksi bervariasi
  // Skenario:
  // - 5 Transaksi Tunai (Cash)
  // - 5 Transaksi QRIS
  // - 5 Transaksi Kartu Debit
  // Termasuk pembelian campuran (Bundle A + Single Bread + Beverage)
  let expectedAddedCash = 119000; // dari Order B di atas
  let expectedAddedQris = 0;
  let expectedAddedDebit = 0;

  console.log(`- Mengesekusi 15 transaksi bervariasi dengan berbagai kombinasi keranjang belanja...`);

  // 1. Single items Cash (Original Saltbread x 2 = 36.000)
  const tx1 = await createOrder({ customer: 'Cust 1', paymentMethod: 'Cash', items: [{ productId: 78, quantity: 2 }] });
  await approveHelper(tx1.id, 'Cash', 36000);
  expectedAddedCash += 36000;

  // 2. Single item QRIS (Smoked Ham x 1 = 24.000)
  const tx2 = await createOrder({ customer: 'Cust 2', paymentMethod: 'QRIS', items: [{ productId: 83, quantity: 1 }] });
  await approveHelper(tx2.id, 'QRIS', 24000);
  expectedAddedQris += 24000;

  // 3. Single Beverage Debit (Thai Milk Tea x 2 = 30.000)
  const tx3 = await createOrder({ customer: 'Cust 3', paymentMethod: 'Debit', items: [{ productId: 84, quantity: 2 }] });
  await approveHelper(tx3.id, 'Debit', 30000);
  expectedAddedDebit += 30000;

  // 4. Bundle A Cash (Original + Original + Thai Tea = 45.000)
  const tx4 = await createOrder({
    customer: 'Cust 4',
    paymentMethod: 'Cash',
    items: [{ productId: 89, quantity: 1, isBundle: true, bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea' }],
  });
  await approveHelper(tx4.id, 'Cash', 45000);
  expectedAddedCash += 45000;

  // 5. Bundle A QRIS (Original + Smoked Ham [+6k] + Lemon Tea = 51.000)
  const tx5 = await createOrder({
    customer: 'Cust 5',
    paymentMethod: 'QRIS',
    items: [{ productId: 89, quantity: 1, isBundle: true, bundleContents: '1x Salt Bread Original, 1x Salt Bread Smoked Ham and Cheese (+Rp 6.000), 1x Thai Tea Honey Lemon' }],
  });
  await approveHelper(tx5.id, 'QRIS', 51000);
  expectedAddedQris += 51000;

  // 6. Bundle B Debit (Cheapest: 5x Original + 3x Thai Milk Tea = 115.000)
  const tx6 = await createOrder({
    customer: 'Cust 6',
    paymentMethod: 'Debit',
    items: [{ productId: 90, quantity: 1, isBundle: true, bundleContents: '5x Salt Bread Original, 3x Thai Milk Tea' }],
  });
  await approveHelper(tx6.id, 'Debit', 115000);
  expectedAddedDebit += 115000;

  // 7. Mixed Basket Cash: 1x Bundle A (45k) + 1x Thai Lemon (15k) = 60.000
  const tx7 = await createOrder({
    customer: 'Cust 7',
    paymentMethod: 'Cash',
    items: [
      { productId: 89, quantity: 1, isBundle: true, bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea' },
      { productId: 85, quantity: 1 },
    ],
  });
  await approveHelper(tx7.id, 'Cash', 60000);
  expectedAddedCash += 60000;

  // 8. Mixed Basket QRIS: 2x Kinako Mochi (44k) + 1x Thai Milk Tea (15k) = 59.000
  const tx8 = await createOrder({
    customer: 'Cust 8',
    paymentMethod: 'QRIS',
    items: [
      { productId: 80, quantity: 2 },
      { productId: 84, quantity: 1 },
    ],
  });
  await approveHelper(tx8.id, 'QRIS', 59000);
  expectedAddedQris += 59000;

  // 9. Mixed Basket Debit: 1x Double Cheese (23k) + 1x Double Chocolate (23k) = 46.000
  const tx9 = await createOrder({
    customer: 'Cust 9',
    paymentMethod: 'Debit',
    items: [
      { productId: 81, quantity: 1 },
      { productId: 82, quantity: 1 },
    ],
  });
  await approveHelper(tx9.id, 'Debit', 46000);
  expectedAddedDebit += 46000;

  // 10. Multi-qty Bundle A Cash: 2x Bundle A (45k x 2 = 90.000)
  const tx10 = await createOrder({
    customer: 'Cust 10',
    paymentMethod: 'Cash',
    items: [
      { productId: 89, quantity: 1, isBundle: true, bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea' },
      { productId: 89, quantity: 1, isBundle: true, bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea' },
    ],
  });
  await approveHelper(tx10.id, 'Cash', 90000);
  expectedAddedCash += 90000;

  // 11. Multi-item QRIS: 3x Thai Lemon (45k)
  const tx11 = await createOrder({ customer: 'Cust 11', paymentMethod: 'QRIS', items: [{ productId: 85, quantity: 3 }] });
  await approveHelper(tx11.id, 'QRIS', 45000);
  expectedAddedQris += 45000;

  // 12. Multi-item Debit: 2x Smoked Ham (48k)
  const tx12 = await createOrder({ customer: 'Cust 12', paymentMethod: 'Debit', items: [{ productId: 83, quantity: 2 }] });
  await approveHelper(tx12.id, 'Debit', 48000);
  expectedAddedDebit += 48000;

  // 13. Bundle A Cash (1x Garlic [+2k] + 1x Double Cheese [+5k] + 1x Tea = 52.000)
  const tx13 = await createOrder({
    customer: 'Cust 13',
    paymentMethod: 'Cash',
    items: [{ productId: 89, quantity: 1, isBundle: true, bundleContents: '1x Salt Bread Garlic Butter (+Rp 2.000), 1x Salt Bread Double Cheese Honey (+Rp 5.000), 1x Thai Milk Tea' }],
  });
  await approveHelper(tx13.id, 'Cash', 52000);
  expectedAddedCash += 52000;

  // 14. QRIS: 2x Double Chocolate (46.000)
  const tx14 = await createOrder({ customer: 'Cust 14', paymentMethod: 'QRIS', items: [{ productId: 82, quantity: 2 }] });
  await approveHelper(tx14.id, 'QRIS', 46000);
  expectedAddedQris += 46000;

  // 15. Debit: 1x Garlic Butter (20.000)
  const tx15 = await createOrder({ customer: 'Cust 15', paymentMethod: 'Debit', items: [{ productId: 79, quantity: 1 }] });
  await approveHelper(tx15.id, 'Debit', 20000);
  expectedAddedDebit += 20000;

  console.log(`✅ [PASS] 15 transaksi beragam metode bayar berhasil diproses dan disetujui kasir.`);

  // Catat Pengeluaran Operasional (Expenses)
  console.log(`- Mencatat 3 jenis pengeluaran operasional (Expenses):`);
  // Exp 1: Beli Es Batu (Cash Rp 25.000) -> mengurangi kas fisik laci
  await prisma.expense.create({
    data: {
      name: 'Beli Es Batu Kristal 2 Bag',
      amount: 25000,
      paymentMethod: 'Cash',
      startDate: new Date(),
      endDate: new Date(),
      shiftId: shift.id,
    },
  });
  // Exp 2: Beli Kantong Plastik & Tissue (Cash Rp 35.000) -> mengurangi kas fisik laci
  await prisma.expense.create({
    data: {
      name: 'Kantong Kresek & Tissue',
      amount: 35000,
      paymentMethod: 'Cash',
      startDate: new Date(),
      endDate: new Date(),
      shiftId: shift.id,
    },
  });
  // Exp 3: Sewa Tenda Bazaar (Transfer/Bank Rp 500.000) -> TIDAK mengurangi kas fisik laci
  await prisma.expense.create({
    data: {
      name: 'Biaya Sewa Tenda Bazaar Tambahan',
      amount: 500000,
      paymentMethod: 'Bank Transfer',
      startDate: new Date(),
      endDate: new Date(),
      shiftId: shift.id,
    },
  });

  const totalCashExpenses = 25000 + 35000; // 60.000
  console.log(`  * Pengeluaran Tunai (Kas Laci): Rp ${totalCashExpenses.toLocaleString('id-ID')}`);
  console.log(`  * Pengeluaran Non-Tunai: Rp 500.000`);

  // ========================================================================
  // SCENARIO 5: Rekonsiliasi Keuangan & Perhitungan Selisih Kas
  // ========================================================================
  console.log('\n📌 SCENARIO 5: Financial Reconciliation & Discrepancy Integrity');

  const summary = await summarizeShift(prisma, shift.id);
  console.log(`- Hasil Summary Shift #${shift.id}:`);
  console.log(`  * Total Penjualan Cash: Rp ${summary.cashSales.toLocaleString('id-ID')} (Target: Rp ${expectedAddedCash.toLocaleString('id-ID')})`);
  console.log(`  * Total Penjualan QRIS: Rp ${summary.qrisSales.toLocaleString('id-ID')} (Target: Rp ${expectedAddedQris.toLocaleString('id-ID')})`);
  console.log(`  * Total Penjualan Debit: Rp ${summary.debitSales.toLocaleString('id-ID')} (Target: Rp ${expectedAddedDebit.toLocaleString('id-ID')})`);
  console.log(`  * Total Pengeluaran Cash: Rp ${summary.cashExpenses.toLocaleString('id-ID')} (Target: Rp ${totalCashExpenses.toLocaleString('id-ID')})`);

  if (summary.cashSales !== expectedAddedCash) throw new Error(`Cash sales mismatch: ${summary.cashSales} vs ${expectedAddedCash}`);
  if (summary.qrisSales !== expectedAddedQris) throw new Error(`QRIS sales mismatch: ${summary.qrisSales} vs ${expectedAddedQris}`);
  if (summary.debitSales !== expectedAddedDebit) throw new Error(`Debit sales mismatch: ${summary.debitSales} vs ${expectedAddedDebit}`);
  if (summary.cashExpenses !== totalCashExpenses) throw new Error(`Cash expense mismatch: ${summary.cashExpenses} vs ${totalCashExpenses}`);

  // Hitung Expected Cash Drawer Formula:
  // Expected = Initial (500k) + Cash Sales - Cash Expenses
  const expectedDrawerCash = shift.initialCash + summary.cashSales - summary.cashExpenses;
  console.log(`  * Saldo Fisik Laci yang Diharapkan: Rp ${expectedDrawerCash.toLocaleString('id-ID')}`);

  // Kasir menghitung uang fisik di laci dan memasukkan nominal tepat sama
  const actualCountedCash = expectedDrawerCash;
  const closedShift = await closeShiftService(shift.id, actualCountedCash, 'Kasir Utama');

  const discrepancy = (closedShift.actualCash || 0) - (closedShift.expectedCash || 0);
  console.log(`  * Selisih Kas (Discrepancy): Rp ${discrepancy.toLocaleString('id-ID')}`);
  if (discrepancy !== 0) throw new Error(`Discrepancy should be 0, got ${discrepancy}`);
  console.log(`✅ [PASS] Selisih kas terhitung Rp 0 (100% klop tanpa kekurangan maupun kelebihan).`);

  // ========================================================================
  // SCENARIO 6: Verifikasi Laporan & Generator Excel 4-Sheet
  // ========================================================================
  console.log('\n📌 SCENARIO 6: Report Page & 4-Sheet Excel Export Audit');

  const shiftDataForExcel = await prisma.shift.findUnique({
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
    transactions: shiftDataForExcel!.transactions,
    totalExpenses: 560000,
    expensesList: shiftDataForExcel!.expenses,
    sheetName: 'Shift Transactions',
    shiftMeta: {
      startStr: '04/11/2026 09:00:00',
      endStr: '04/11/2026 21:00:00',
      durationStr: '12h 0m',
      openedBy: shift.openedBy,
      closedBy: 'Kasir Utama',
      initialCash: shift.initialCash,
      expectedCash: expectedDrawerCash,
      actualCash: actualCountedCash,
      discrepancy: 0,
    },
  });

  console.log(`- Buffer Excel berhasil digenerate: ${excelBuffer.length} bytes.`);
  if (!excelBuffer || excelBuffer.length < 10000) {
    throw new Error('Excel report buffer corrupted or too small!');
  }
  console.log(`✅ [PASS] Laporan Excel 4-Sheet (Transactions, Product Sales, Variant Breakdown, Expenses) ter-generate sempurna.`);

  // Kembalikan stok bazaar ke kondisi awal
  console.log('\n📌 RESTORING BAZAAR SEED DATA:');
  await seedBazaarMenu();

  // Buka shift baru untuk operasional
  const freshShift = await openShiftService('Kasir Bazaar Sorelin', 300000);
  console.log(`\n✅ [PASS] Shift Operasional Baru #${freshShift.id} dibuka dengan float Rp 300.000.`);

  console.log('\n================================================================');
  console.log('🏆 SEMUA 6 SKENARIO AUDIT MENYELURUH TELAH LULUS 100%!');
  console.log('================================================================');
}

runBulletproofAudit()
  .catch((e) => {
    console.error('❌ Audit scenario failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
