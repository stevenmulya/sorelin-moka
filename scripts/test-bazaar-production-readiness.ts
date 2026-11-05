import { prisma } from '../src/lib/prisma';
import { seedCleanInitialProducts, INITIAL_BAZAAR_PRODUCTS } from '../prisma/seed';
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
} from '../src/lib/services/orders';
import {
  adjustStockService,
  createProductService,
  parseProductForm,
} from '../src/lib/services/products';
import {
  listCategoriesService,
  createCategoryService,
} from '../src/lib/services/categories';
import {
  serializeBundleConfig,
  getBundleMaxStock,
  getCartProductDemand,
  canIncrementCartItem,
  calculateBundlePriceStats,
} from '../src/lib/bundle-config';
import { STATUS } from '../src/lib/constants';
import { formatRupiah } from '../src/lib/utils';
import { buildTransactionsExcelBuffer } from '../src/lib/excel';
import * as XLSX from 'xlsx';

async function runBazaarProductionReadinessAudit() {
  console.log('================================================================');
  console.log('🛡️ SORELIN POS — DEEP PRODUCTION READINESS & E2E AUDIT');
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
    // 1. CLEAN SEED VERIFICATION (8 OFFICIAL PRODUCTS ONLY)
    // -------------------------------------------------------------
    console.log('📌 PHASE 1: Clean Seed & 8 Official Products Verification');
    await seedCleanInitialProducts();

    const seededProducts = await prisma.product.findMany({
      include: { type: true },
      orderBy: { id: 'asc' },
    });
    assert(
      seededProducts.length === 8,
      'Database seeded with exactly 8 products and 0 bundles',
      `Count: ${seededProducts.length}`,
    );

    for (const expected of INITIAL_BAZAAR_PRODUCTS) {
      const found = seededProducts.find((p) => p.name === expected.name);
      assert(
        Boolean(
          found &&
            found.price === expected.price &&
            found.costPrice === expected.costPrice &&
            found.type?.name === expected.category &&
            !found.isBundle,
        ),
        `Verified product: ${expected.name}`,
        `Jual: ${formatRupiah(found?.price || 0)} | Modal: ${formatRupiah(found?.costPrice || 0)} | Cat: ${found?.type?.name}`,
      );
    }

    const categories = await listCategoriesService();
    assert(
      categories.length === 2 &&
        categories.some((c) => c.name === 'Saltbread' && c.productCount === 6) &&
        categories.some((c) => c.name === 'Beverage' && c.productCount === 2),
      'Categories strictly contain Saltbread (6) and Beverage (2) with no fake Bundle category',
    );

    let reservedCatBlocked = false;
    try {
      await createCategoryService('Bundle');
    } catch {
      reservedCatBlocked = true;
    }
    assert(reservedCatBlocked, 'Reserved category name "Bundle" is blocked from creation');

    // -------------------------------------------------------------
    // 2. BUNDLE MANAGEMENT & DYNAMIC STOCK CONNECTION
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 2: Bundle Management & Connected Stock Logic');

    // Test empty bundle slots rejected
    let emptyBundleRejected = false;
    try {
      const badForm = new FormData();
      badForm.set('name', 'Invalid Empty Bundle');
      badForm.set('price', '45000');
      badForm.set('costPrice', '20000');
      badForm.set('isBundle', 'true');
      badForm.set('bundleQuota', '2');
      badForm.set('availableVariants', JSON.stringify({ slots: [] }));
      parseProductForm(badForm);
    } catch {
      emptyBundleRejected = true;
    }
    assert(emptyBundleRejected, 'Bundle creation without component slots is rejected');

    // Create Bundle 1: Category-based (2x Saltbread + 1x Beverage = Rp 45.000)
    const bundle1Config = serializeBundleConfig({
      slots: [
        { id: 'slot-sb', type: 'CATEGORY', categoryName: 'Saltbread', quota: 2 },
        { id: 'slot-bev', type: 'CATEGORY', categoryName: 'Beverage', quota: 1 },
      ],
    });
    const bundle1Form = new FormData();
    bundle1Form.set('name', 'Paket Hemat A (2 Saltbread + 1 Beverage)');
    bundle1Form.set('type', '');
    bundle1Form.set('price', '45000');
    bundle1Form.set('costPrice', '33000'); // 2*13k + 1*7k
    bundle1Form.set('stock', '0');
    bundle1Form.set('isBundle', 'true');
    bundle1Form.set('bundleQuota', '3');
    bundle1Form.set('availableVariants', bundle1Config);
    bundle1Form.set('description', 'Pilih 2 Saltbread + 1 Minuman');

    const bundle1Input = parseProductForm(bundle1Form);
    const bundle1 = await createProductService(bundle1Input, []);

    assert(
      bundle1.isBundle && bundle1.stock === 0 && bundle1.typeId === null && bundle1.bundleQuota === 3,
      'Category Bundle created with stock=0 and typeId=null (does not pollute Categories)',
      `Bundle ID #${bundle1.id}: ${bundle1.name}`,
    );

    // Create Bundle 2: Fixed Product + Category slot (1x Smoked Ham and Cheese + 1x Saltbread + 1x Thai Milk Tea = Rp 52.000)
    const sbHam = seededProducts.find((p) => p.name === 'Salt Bread Smoked Ham and Cheese')!;
    const thaiMilk = seededProducts.find((p) => p.name === 'Thai Milk Tea')!;

    const bundle2Config = serializeBundleConfig({
      slots: [
        { id: 'slot-fixed-ham', type: 'PRODUCT', productId: sbHam.id, productName: sbHam.name, quantity: 1 },
        { id: 'slot-cat-sb', type: 'CATEGORY', categoryName: 'Saltbread', quota: 1 },
        { id: 'slot-fixed-tea', type: 'PRODUCT', productId: thaiMilk.id, productName: thaiMilk.name, quantity: 1 },
      ],
    });
    const bundle2Form = new FormData();
    bundle2Form.set('name', 'Paket Spesial Ham & Tea');
    bundle2Form.set('type', '');
    bundle2Form.set('price', '52000');
    bundle2Form.set('costPrice', '40000'); // 20k + 13k + 7k
    bundle2Form.set('stock', '0');
    bundle2Form.set('isBundle', 'true');
    bundle2Form.set('bundleQuota', '3');
    bundle2Form.set('availableVariants', bundle2Config);

    const bundle2 = await createProductService(parseProductForm(bundle2Form), []);
    assert(
      bundle2.isBundle && bundle2.bundleQuota === 3,
      'Mixed Fixed-Product + Category Bundle created accurately',
      `Bundle ID #${bundle2.id}: ${bundle2.name}`,
    );

    // Create Bundle 3 (User's Exact Scenario: 1x Original + 1x [Choco OR Cheese] + 1x Beverage with Rp 5.000 Bundle Discount)
    const sbOrigInit = seededProducts.find((p) => p.name === 'Salt Bread Original')!;
    const bundle3Slots = [
      { id: 'slot-orig', type: 'PRODUCT' as const, productId: sbOrigInit.id, productName: sbOrigInit.name, quantity: 1 },
      {
        id: 'slot-choco-cheese',
        type: 'CATEGORY' as const,
        categoryName: 'Double Chocolate / Double Cheese Honey',
        quota: 1,
        allowedProductNames: ['Salt Bread Double Chocolate', 'Salt Bread Double Cheese Honey'],
      },
      {
        id: 'slot-drink',
        type: 'CATEGORY' as const,
        categoryName: 'Beverage',
        quota: 1,
        allowedProductNames: ['Thai Milk Tea', 'Thai Tea Honey Lemon'],
      },
    ];
    const bundle3Stats = calculateBundlePriceStats(bundle3Slots, 5000, seededProducts);
    assert(
      bundle3Stats.minNormalPrice === 56_000 &&
        bundle3Stats.maxNormalPrice === 56_000 &&
        bundle3Stats.minFinalPrice === 51_000 &&
        bundle3Stats.maxFinalPrice === 51_000 &&
        bundle3Stats.minCostPrice === 36_000 &&
        bundle3Stats.maxCostPrice === 37_000 &&
        bundle3Stats.minProfit === 14_000 &&
        bundle3Stats.maxProfit === 15_000,
      'calculateBundlePriceStats computes exact Min-Max Price (Rp 51k), HPP (Rp 36k-37k), and Profit (Rp 14k-15k) with zero fake averages',
      `Final Price: Rp ${bundle3Stats.minFinalPrice} | HPP: Rp ${bundle3Stats.minCostPrice}–${bundle3Stats.maxCostPrice} | Profit: Rp ${bundle3Stats.minProfit}–${bundle3Stats.maxProfit}`,
    );

    const bundle3Config = serializeBundleConfig({
      slots: bundle3Slots,
      discountAmount: 5000,
    });
    const bundle3Form = new FormData();
    bundle3Form.set('name', 'Paket Trio Favorit (Original + Choco/Cheese + Thai Tea)');
    bundle3Form.set('type', '');
    bundle3Form.set('price', String(bundle3Stats.minFinalPrice));
    bundle3Form.set('costPrice', String(bundle3Stats.minCostPrice));
    bundle3Form.set('stock', '0');
    bundle3Form.set('isBundle', 'true');
    bundle3Form.set('bundleQuota', '3');
    bundle3Form.set('availableVariants', bundle3Config);

    const bundle3 = await createProductService(parseProductForm(bundle3Form), []);
    assert(
      bundle3.isBundle && bundle3.price === 51_000 && bundle3.costPrice === 36_000,
      'Discount-based Specific-Options Bundle created accurately (Rp 56.000 - Rp 5.000 = Rp 51.000)',
      `Bundle ID #${bundle3.id}: ${bundle3.name}`,
    );

    // Create Bundle 4 (User's Exact Request: "Bundle 3 Item Sorelin" @ Fixed Price Rp 60.000 flat)
    // Slot 1: Fixed 1x Salt Bread Original
    // Slot 2: Choice 1x Any Saltbread
    // Slot 3: Choice 1x Any Beverage
    const bundle4Slots = [
      { id: 'slot-sorelin-orig', type: 'PRODUCT' as const, productId: sbOrigInit.id, productName: sbOrigInit.name, quantity: 1 },
      { id: 'slot-sorelin-sb', type: 'CATEGORY' as const, categoryName: 'Saltbread', quota: 1 },
      { id: 'slot-sorelin-bev', type: 'CATEGORY' as const, categoryName: 'Beverage', quota: 1 },
    ];
    const bundle4Stats = calculateBundlePriceStats(
      bundle4Slots,
      { pricingMode: 'FIXED', fixedPrice: 60_000 },
      seededProducts,
    );
    assert(
      bundle4Stats.minFinalPrice === 60_000 &&
        bundle4Stats.maxFinalPrice === 60_000 &&
        bundle4Stats.minCostPrice === 33_000 &&
        bundle4Stats.maxCostPrice === 40_000 &&
        bundle4Stats.minProfit === 20_000 &&
        bundle4Stats.maxProfit === 27_000,
      'Fixed-Price Bundle stats compute flat Rp 60.000 price, real HPP range (Rp 33k–40k), and real Profit range (Rp 20k–27k)',
      `Price: Rp ${bundle4Stats.minFinalPrice} flat | HPP: Rp ${bundle4Stats.minCostPrice}–${bundle4Stats.maxCostPrice} | Profit: Rp ${bundle4Stats.minProfit}–${bundle4Stats.maxProfit}`,
    );

    const bundle4Config = serializeBundleConfig({
      slots: bundle4Slots,
      pricingMode: 'FIXED',
      fixedPrice: 60_000,
    });
    const bundle4Form = new FormData();
    bundle4Form.set('name', 'Bundle 3 Item Sorelin');
    bundle4Form.set('type', '');
    bundle4Form.set('price', '60000');
    bundle4Form.set('costPrice', String(bundle4Stats.minCostPrice));
    bundle4Form.set('stock', '0');
    bundle4Form.set('isBundle', 'true');
    bundle4Form.set('bundleQuota', '3');
    bundle4Form.set('availableVariants', bundle4Config);

    const bundle4 = await createProductService(parseProductForm(bundle4Form), []);
    assert(
      bundle4.isBundle && bundle4.price === 60_000 && bundle4.costPrice === 33_000,
      'Fixed-Price Bundle ("Bundle 3 Item Sorelin" @ Rp 60.000 flat) created accurately',
      `Bundle ID #${bundle4.id}: ${bundle4.name}`,
    );

    // Verify getBundleMaxStock overlapping slot feasibility (Fixed 1x Original + Choice 1x Saltbread):
    // If Original = 1, all other Saltbreads = 0, Beverages = 10 -> Cannot form even 1 box because Slot 1 takes the only Original!
    const mockCatalogOverlapZero = seededProducts.map((p) => ({
      ...p,
      stock: p.name === 'Salt Bread Original' ? 1 : p.name === 'Thai Milk Tea' ? 10 : 0,
    }));
    const mockCatalogOverlapOne = seededProducts.map((p) => ({
      ...p,
      stock: p.name === 'Salt Bread Original' ? 2 : p.name === 'Thai Milk Tea' ? 10 : 0,
    }));
    assert(
      getBundleMaxStock(bundle4, mockCatalogOverlapZero) === 0 &&
        getBundleMaxStock(bundle4, mockCatalogOverlapOne) === 1,
      'getBundleMaxStock prevents overlapping fixed + choice slot double-counting (requires 2 total Saltbreads when Original is fixed in Slot 1)',
    );

    // Verify Inventory query excludes bundles
    // Restock the 8 single products to 50 pcs each to simulate morning bazaar baking batch
    await prisma.product.updateMany({
      where: { isBundle: false },
      data: { stock: 50 },
    });

    const inventoryProducts = await prisma.product.findMany({
      where: { isActive: true, isBundle: false },
    });
    const lowStockCount = await prisma.product.count({
      where: { isActive: true, isBundle: false, stock: { lte: 5 } },
    });
    assert(
      inventoryProducts.length === 8 && lowStockCount === 0,
      'Inventory stock list & Low-Stock counter exclude bundles (only 8 real products tracked)',
    );

    // Verify manual stock adjustment on bundle is blocked
    let bundleStockAdjustBlocked = false;
    try {
      await adjustStockService({
        productId: bundle1.id,
        type: 'IN',
        quantity: 10,
      });
    } catch {
      bundleStockAdjustBlocked = true;
    }
    assert(bundleStockAdjustBlocked, 'Manual stock adjustment on bundle is blocked at service layer');

    // Verify dynamic connected stock calculation (getBundleMaxStock)
    // 6 Saltbreads * 50 = 300 total saltbreads -> 300 / 2 = 150 sets
    // 2 Beverages * 50 = 100 total beverages -> 100 / 1 = 100 sets
    // Max sets for Bundle 1 = min(150, 100) = 100 sets
    const singleCatalog = await prisma.product.findMany({
      where: { isActive: true, isBundle: false },
      include: { type: true },
    });
    const maxStockBundle1 = getBundleMaxStock(bundle1, singleCatalog);
    assert(
      maxStockBundle1 === 100,
      'Dynamic bundle stock (getBundleMaxStock) accurately computes 100 sets from component stock',
      `Saltbread pool: 300 (quota 2 -> 150), Beverage pool: 100 (quota 1 -> 100) => Max: ${maxStockBundle1}`,
    );

    // Test cart demand & canIncrementCartItem when single items + bundles share components
    const sbOrig = singleCatalog.find((p) => p.name === 'Salt Bread Original')!;
    const simulatedCart = [
      {
        product: sbOrig,
        quantity: 48,
        isBundle: false,
      },
      {
        product: bundle1,
        quantity: 1,
        isBundle: true,
        bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea',
      },
    ];
    const cartDemand = getCartProductDemand(simulatedCart, [
      ...singleCatalog,
      bundle1,
    ]);
    assert(
      cartDemand.get(sbOrig.id) === 50 && cartDemand.get(thaiMilk.id) === 1,
      'getCartProductDemand aggregates single item + bundle component usage accurately',
      `Salt Bread Original demand: ${cartDemand.get(sbOrig.id)}/50, Thai Milk Tea demand: ${cartDemand.get(thaiMilk.id)}/50`,
    );
    assert(
      !canIncrementCartItem(simulatedCart[1], simulatedCart, [...singleCatalog, bundle1]),
      'canIncrementCartItem blocks adding another bundle when component stock (50/50) is exhausted in cart',
    );

    // -------------------------------------------------------------
    // 3. MANUAL INVENTORY STOCK ADJUSTMENTS (IN / OUT / RESET)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 3: Manual Inventory Stock Adjustments');
    await adjustStockService({
      productId: sbOrig.id,
      type: 'IN',
      quantity: 10,
      giver: 'Dapur Utama',
      receiver: 'Kasir 1',
      notes: 'Tambahan batch pagi',
    });
    const sbOrigAfterIn = await prisma.product.findUnique({ where: { id: sbOrig.id } });
    assert(sbOrigAfterIn?.stock === 60, 'Stock IN added +10 pcs to Salt Bread Original (50 -> 60)');

    await adjustStockService({
      productId: sbOrig.id,
      type: 'OUT',
      quantity: 10,
      receiver: 'Kasir 1',
      notes: 'Koreksi kembali ke 50',
    });
    const sbOrigAfterOut = await prisma.product.findUnique({ where: { id: sbOrig.id } });
    assert(sbOrigAfterOut?.stock === 50, 'Stock OUT deducted 10 pcs from Salt Bread Original (60 -> 50)');

    // -------------------------------------------------------------
    // 4. SHIFT INITIALIZATION
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 4: Shift Lifecycle & Petty Cash Float');
    const existingShift = await getActiveShift();
    if (existingShift) {
      await closeShiftService(existingShift.id, 0, 'AutoClean');
    }

    const initialFloat = 300_000;
    const shift = await openShiftService('Kasir Bazaar iPad', initialFloat);
    assert(
      Boolean(shift && shift.initialCash === initialFloat),
      'Shift opened with Rp 300.000 petty cash float',
    );

    // -------------------------------------------------------------
    // 5. KIOSK & CASHIER ORDERS (SINGLE + CATEGORY BUNDLE + FIXED BUNDLE)
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 5: Order Creation, Bundle Tier Upcharges & COGS Calculation');
    const honeyLemon = singleCatalog.find((p) => p.name === 'Thai Tea Honey Lemon')!;
    const doubleChoco = singleCatalog.find((p) => p.name === 'Salt Bread Double Chocolate')!;

    // Security check: Tampered bundle order with wrong item count (e.g. 5 items in a 3-item bundle) must be rejected
    let tamperedBundleQuotaRejected = false;
    try {
      await createOrder({
        customer: 'Tamperer Bundle',
        items: [
          {
            productId: bundle1.id,
            quantity: 1,
            isBundle: true,
            bundleContents: '4x Salt Bread Original, 1x Thai Milk Tea',
          },
        ],
      });
    } catch {
      tamperedBundleQuotaRejected = true;
    }
    assert(
      tamperedBundleQuotaRejected,
      'Tampered bundle order with mismatched item quota (5 items instead of 3) is rejected by server',
    );

    // Security check: Tampered bundle order missing required fixed product slot must be rejected
    let missingFixedItemRejected = false;
    try {
      await createOrder({
        customer: 'Tamperer Fixed',
        items: [
          {
            productId: bundle2.id,
            quantity: 1,
            isBundle: true,
            bundleContents: '2x Salt Bread Original, 1x Thai Milk Tea',
          },
        ],
      });
    } catch {
      missingFixedItemRejected = true;
    }
    assert(
      missingFixedItemRejected,
      'Tampered bundle order missing required fixed product (Salt Bread Smoked Ham and Cheese) is rejected by server',
    );

    // Order 1:
    // - 2x Salt Bread Original (2 * 18.000 = 36.000, COGS: 2 * 13.000 = 26.000)
    // - 1x Thai Tea Honey Lemon (1 * 15.000 = 15.000, COGS: 1 * 7.000 = 7.000)
    // - 1x Paket Hemat A (Base 45.000 + Smoked Ham upcharge (24.000 - 18.000 = +6.000) = 51.000,
    //     Components: 1x Salt Bread Original (13k) + 1x Salt Bread Smoked Ham and Cheese (20k) + 1x Thai Milk Tea (7k) -> COGS = 40.000)
    // Expected Total Price = 36.000 + 15.000 + 51.000 = 102.000
    // Expected Total COGS = 26.000 + 7.000 + 40.000 = 73.000
    const order1 = await createOrder({
      customer: 'Clarissa Putri',
      email: 'clarissa@example.com',
      phone: '081234567890',
      items: [
        {
          productId: sbOrig.id,
          quantity: 2,
          isBundle: false,
        },
        {
          productId: honeyLemon.id,
          quantity: 1,
          isBundle: false,
        },
        {
          productId: bundle1.id,
          quantity: 1,
          isBundle: true,
          bundleContents:
            '1x Salt Bread Original, 1x Salt Bread Smoked Ham and Cheese (+Rp 6.000), 1x Thai Milk Tea',
        },
      ],
    });

    const order1WithItems = await prisma.transaction.findUnique({
      where: { id: order1.id },
      include: { items: true },
    });
    const order1TotalCogs = order1WithItems!.items.reduce(
      (sum, it) => sum + it.costPrice * it.quantity,
      0,
    );

    assert(
      order1.amount === 102_000,
      'Order 1 total price accurately includes base bundle + category tier upcharge (+Rp 6.000)',
      `Expected: Rp 102.000, Actual: ${formatRupiah(order1.amount)}`,
    );
    assert(
      order1TotalCogs === 73_000,
      'Order 1 COGS (Harga Modal) accurately sums single items + real bundle components',
      `Expected COGS: Rp 73.000, Actual COGS: ${formatRupiah(order1TotalCogs)}`,
    );

    // Approve Order 1 with Cash (Paid Rp 110.000)
    await approvePaymentService({
      transactionId: order1.id,
      cashierName: 'Kasir Bazaar iPad',
      paymentMethod: 'Cash',
      paidAmount: 110_000,
    });

    // Verify component stock deductions:
    // Salt Bread Original: 50 - 2 (single) - 1 (bundle) = 47
    // Salt Bread Smoked Ham and Cheese: 50 - 1 (bundle) = 49
    // Thai Tea Honey Lemon: 50 - 1 (single) = 49
    // Thai Milk Tea: 50 - 1 (bundle) = 49
    const sbOrigStock1 = (await prisma.product.findUnique({ where: { id: sbOrig.id } }))!.stock;
    const sbHamStock1 = (await prisma.product.findUnique({ where: { id: sbHam.id } }))!.stock;
    const honeyLemonStock1 = (await prisma.product.findUnique({ where: { id: honeyLemon.id } }))!.stock;
    const thaiMilkStock1 = (await prisma.product.findUnique({ where: { id: thaiMilk.id } }))!.stock;
    const bundle1StockAfter = (await prisma.product.findUnique({ where: { id: bundle1.id } }))!.stock;

    assert(
      sbOrigStock1 === 47 && sbHamStock1 === 49 && honeyLemonStock1 === 49 && thaiMilkStock1 === 49 && bundle1StockAfter === 0,
      'Component product stocks deducted accurately for both single items and bundle contents',
      `Original: ${sbOrigStock1}, Smoked Ham: ${sbHamStock1}, Honey Lemon: ${honeyLemonStock1}, Thai Milk: ${thaiMilkStock1}`,
    );

    // Verify no InventoryLog was created for the virtual bundle wrapper
    const bundleLogs = await prisma.inventoryLog.count({ where: { productId: bundle1.id } });
    assert(bundleLogs === 0, 'Zero duplicate InventoryLog entries created on virtual bundle product');

    // Order 2: Mixed Fixed-Product + Category Bundle (Bundle 2)
    // Fixed: 1x Salt Bread Smoked Ham and Cheese (should NOT incur +6k category upcharge!)
    // Category: 1x Salt Bread Double Chocolate (23k - 18k = +5k upcharge)
    // Fixed: 1x Thai Milk Tea (+0)
    // Expected Price: Base 52.000 + 5.000 = 57.000
    // Expected COGS: 20.000 (Ham) + 17.000 (Choco) + 7.000 (Thai Milk) = 44.000
    const order2 = await createOrder({
      customer: 'Budi Santoso',
      items: [
        {
          productId: bundle2.id,
          quantity: 1,
          isBundle: true,
          bundleContents:
            '1x Salt Bread Smoked Ham and Cheese, 1x Salt Bread Double Chocolate (+Rp 5.000), 1x Thai Milk Tea',
        },
      ],
    });
    const order2WithItems = await prisma.transaction.findUnique({
      where: { id: order2.id },
      include: { items: true },
    });
    assert(
      order2.amount === 57_000 && order2WithItems!.items[0].costPrice === 44_000,
      'Fixed-product slot in bundle does NOT incur category upcharge while Category slot adds +Rp 5.000 & accurate COGS (Rp 44.000)',
      `Price: ${formatRupiah(order2.amount)}, COGS: ${formatRupiah(order2WithItems!.items[0].costPrice)}`,
    );

    await approvePaymentService({
      transactionId: order2.id,
      cashierName: 'Kasir Bazaar iPad',
      paymentMethod: 'QRIS',
      paidAmount: order2.amount,
    });

    // Security check on Bundle 3: Trying to pick "Salt Bread Garlic Butter" in the [Choco OR Cheese] slot must be rejected!
    let disallowedSlotOptionRejected = false;
    try {
      await createOrder({
        customer: 'Sneaky Buyer',
        items: [
          {
            productId: bundle3.id,
            quantity: 1,
            isBundle: true,
            bundleContents: '1x Salt Bread Original, 1x Salt Bread Garlic Butter, 1x Thai Milk Tea',
          },
        ],
      });
    } catch {
      disallowedSlotOptionRejected = true;
    }
    assert(
      disallowedSlotOptionRejected,
      'Specific-Options Bundle rejects product ("Salt Bread Garlic Butter") that is not in allowedProductNames [Choco, Cheese]',
    );

    // Order 3A & 3B on Bundle 3: Verify discount-based selling price (Rp 51.000) and exact per-choice COGS (Rp 37.000 for Choco vs Rp 36.000 for Cheese)
    const order3 = await createOrder({
      customer: 'Nadia Kusuma',
      items: [
        {
          productId: bundle3.id,
          quantity: 1,
          isBundle: true,
          bundleContents: '1x Salt Bread Original, 1x Salt Bread Double Chocolate, 1x Thai Milk Tea',
        },
        {
          productId: bundle3.id,
          quantity: 1,
          isBundle: true,
          bundleContents: '1x Salt Bread Original, 1x Salt Bread Double Cheese Honey, 1x Thai Tea Honey Lemon',
        },
      ],
    });
    const order3WithItems = await prisma.transaction.findUnique({
      where: { id: order3.id },
      include: { items: true },
    });
    const itemChoco = order3WithItems!.items[0];
    const itemCheese = order3WithItems!.items[1];
    assert(
      order3.amount === 102_000 &&
        itemChoco.price === 51_000 &&
        itemChoco.costPrice === 37_000 &&
        itemCheese.price === 51_000 &&
        itemCheese.costPrice === 36_000,
      'Bundle 3 records exact selling price (Rp 51.000 after Rp 5.000 discount) and exact real HPP per choice (Rp 37.000 for Choco vs Rp 36.000 for Cheese)',
      `Box 1 (Choco): Sell ${formatRupiah(itemChoco.price)}, HPP ${formatRupiah(itemChoco.costPrice)} | Box 2 (Cheese): Sell ${formatRupiah(itemCheese.price)}, HPP ${formatRupiah(itemCheese.costPrice)}`,
    );
    // Cancel Order 3 (Waiting Payment) so stock counts for Phase 6-8 remain unchanged
    await cancelOrderService({
      transactionId: order3.id,
      reason: 'Test verification complete',
    });

    // Order 4 on Bundle 4 ("Bundle 3 Item Sorelin" @ Fixed Price Rp 60.000 flat):
    // - Box 1: Fixed 1x Original + Choice 1x Smoked Ham and Cheese + Choice 1x Thai Milk Tea
    //   -> Selling Price MUST be Rp 60.000 flat (NO +Rp 6.000 upcharge!), COGS = 13k + 20k + 7k = Rp 40.000
    // - Box 2: Fixed 1x Original + Choice 1x Original (merged as "2x Salt Bread Original, 1x Thai Tea Honey Lemon")
    //   -> Selling Price MUST be Rp 60.000 flat, COGS = 13k + 13k + 7k = Rp 33.000
    const order4 = await createOrder({
      customer: 'Kevin Wijaya',
      items: [
        {
          productId: bundle4.id,
          quantity: 1,
          isBundle: true,
          bundleContents: '1x Salt Bread Original, 1x Salt Bread Smoked Ham and Cheese, 1x Thai Milk Tea',
        },
        {
          productId: bundle4.id,
          quantity: 1,
          isBundle: true,
          bundleContents: '2x Salt Bread Original, 1x Thai Tea Honey Lemon',
        },
      ],
    });
    const order4WithItems = await prisma.transaction.findUnique({
      where: { id: order4.id },
      include: { items: true },
    });
    const box4Ham = order4WithItems!.items[0];
    const box4DoubleOrig = order4WithItems!.items[1];
    assert(
      order4.amount === 120_000 &&
        box4Ham.price === 60_000 &&
        box4Ham.costPrice === 40_000 &&
        box4DoubleOrig.price === 60_000 &&
        box4DoubleOrig.costPrice === 33_000,
      'Fixed-Price Bundle ("Bundle 3 Item Sorelin") keeps selling price strictly Rp 60.000 flat regardless of choice while recording exact component HPP (Rp 40.000 vs Rp 33.000)',
      `Box 1 (with Smoked Ham): Sell ${formatRupiah(box4Ham.price)}, HPP ${formatRupiah(box4Ham.costPrice)} | Box 2 (2x Original): Sell ${formatRupiah(box4DoubleOrig.price)}, HPP ${formatRupiah(box4DoubleOrig.costPrice)}`,
    );

    // Approve Order 4 to verify physical stock deduction when customer picks Original again in Slot 2 (3x Original total deducted), then cancel to verify full restock
    await approvePaymentService({
      transactionId: order4.id,
      cashierName: 'Kasir Bazaar iPad',
      paymentMethod: 'QRIS',
      paidAmount: order4.amount,
    });
    const sbOrigDuringOrder4 = (await prisma.product.findUnique({ where: { id: sbOrig.id } }))!.stock;
    const sbHamDuringOrder4 = (await prisma.product.findUnique({ where: { id: sbHam.id } }))!.stock;
    assert(
      sbOrigDuringOrder4 === 44 && sbHamDuringOrder4 === 47,
      'Fixed-Price Bundle payment approval accurately deducts 3x Salt Bread Original (47 -> 44) and 1x Smoked Ham (48 -> 47)',
    );
    await cancelOrderService({
      transactionId: order4.id,
      reason: 'Verify full restock of Fixed-Price Bundle components',
    });
    const sbOrigAfterCancelOrder4 = (await prisma.product.findUnique({ where: { id: sbOrig.id } }))!.stock;
    const sbHamAfterCancelOrder4 = (await prisma.product.findUnique({ where: { id: sbHam.id } }))!.stock;
    assert(
      sbOrigAfterCancelOrder4 === 47 && sbHamAfterCancelOrder4 === 48,
      'Cancelling paid Fixed-Price Bundle order accurately restores all 6 physical component items (Original: 44 -> 47, Smoked Ham: 47 -> 48)',
    );

    // -------------------------------------------------------------
    // 6. CONCURRENT KIOSK ORDER RACE CONDITION / ATOMIC STOCK GUARD
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 6: Concurrent Kiosk Order Atomic Stock Guard');
    // Currently Salt Bread Double Chocolate has stock = 49 (50 - 1 from Order 2).
    // Two Kiosk customers place Waiting Payment orders for 30 pcs each while stock is 49:
    const raceOrderA = await createOrder({
      customer: 'Customer Race A',
      items: [{ productId: doubleChoco.id, quantity: 30, isBundle: false }],
    });
    const raceOrderB = await createOrder({
      customer: 'Customer Race B',
      items: [{ productId: doubleChoco.id, quantity: 30, isBundle: false }],
    });

    // Cashier approves Race Order A (stock becomes 49 - 30 = 19)
    await approvePaymentService({
      transactionId: raceOrderA.id,
      cashierName: 'Kasir Bazaar iPad',
      paymentMethod: 'Debit',
      paidAmount: raceOrderA.amount,
    });

    // Cashier tries to approve Race Order B (needs 30, only 19 left) -> MUST FAIL and rollback!
    let raceOrderBBlocked = false;
    try {
      await approvePaymentService({
        transactionId: raceOrderB.id,
        cashierName: 'Kasir Bazaar iPad',
        paymentMethod: 'QRIS',
        paidAmount: raceOrderB.amount,
      });
    } catch {
      raceOrderBBlocked = true;
    }
    const chocoStockAfterRace = (await prisma.product.findUnique({ where: { id: doubleChoco.id } }))!.stock;
    assert(
      raceOrderBBlocked && chocoStockAfterRace === 19,
      'Atomic stock guard blocked second competing order from pushing stock negative (remained at 19 pcs)',
    );

    // Cancel the unapprovable Waiting order B
    await cancelOrderService({
      transactionId: raceOrderB.id,
      reason: 'Stock habis saat antri bayar',
    });

    // -------------------------------------------------------------
    // 7. ORDER PROGRESSION, PAYMENT EDIT & CANCELLATION RESTOCK
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 7: Order Status Progression, Payment Edit & Paid Cancellation');
    await changeStatusService(order1.id, STATUS.READY);
    await changeStatusService(order1.id, STATUS.PICKED_UP);

    // Edit payment on Race Order A from Debit -> QRIS, then cancel Race Order A while Preparing to restore 30 pcs!
    await editPaymentService({
      transactionId: raceOrderA.id,
      paymentMethod: 'QRIS',
      paidAmount: raceOrderA.amount,
    });
    const raceAAfterEdit = await prisma.transaction.findUnique({ where: { id: raceOrderA.id } });
    assert(raceAAfterEdit?.paymentMethod === 'QRIS', 'Payment method edit (Debit -> QRIS) succeeded');

    await cancelOrderService({
      transactionId: raceOrderA.id,
      reason: 'Customer cancel sebelum diambil',
    });
    const chocoStockAfterCancel = (await prisma.product.findUnique({ where: { id: doubleChoco.id } }))!.stock;
    assert(
      chocoStockAfterCancel === 49,
      'Cancelling paid Preparing order restored exact 30 pcs back to stock (19 -> 49)',
    );

    // -------------------------------------------------------------
    // 8. EXPENSES, FINANCIAL SUMMARY & EXCEL 4-SHEET REPORT
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 8: Expenses, Financial Summary & 4-Sheet Excel Report');
    await createExpenseService('Beli Es Batu & Cup', 25_000, 'Cash');
    await createExpenseService('Sewa Booth Hari Pertama', 500_000, 'Transfer');

    const summary = await summarizeShift(prisma, shift.id);
    // Paid active orders:
    // Order 1 (Cash): Revenue = 102.000, COGS = 73.000
    // Order 2 (QRIS): Revenue = 57.000, COGS = 44.000
    // Total Revenue = 159.000, Total COGS = 117.000, Gross Profit = 42.000
    // Total Expenses = 525.000 (Cash: 25.000, Transfer: 500.000)
    // Net Profit = 42.000 - 525.000 = -483.000
    // Expected Drawer Cash = Initial (300.000) + Cash Sales (102.000) - Cash Expenses (25.000) = 377.000
    const grossProfit = summary.revenue - summary.cogs;
    const expectedCash = expectedCashOf(shift.initialCash, summary);
    assert(
      summary.revenue === 159_000 &&
        summary.cogs === 117_000 &&
        grossProfit === 42_000 &&
        summary.expenses === 525_000 &&
        summary.netProfit === -483_000 &&
        expectedCash === 377_000,
      'Financial reconciliation (Revenue, COGS, Gross Profit, Expenses, Net Profit, Expected Drawer Cash) is 100% exact',
      `Rev: ${formatRupiah(summary.revenue)} | COGS: ${formatRupiah(summary.cogs)} | Gross: ${formatRupiah(grossProfit)} | Expected Cash: ${formatRupiah(expectedCash)}`,
    );

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
      totalExpenses: summary.expenses,
      expensesList: shiftExpenses,
      sheetName: `Shift-${shift.id}`,
      periodLabel: `Bazaar Audit Shift #${shift.id}`,
    });

    const wb = XLSX.read(excelBuffer, { type: 'buffer' });
    assert(
      wb.SheetNames.length === 4 &&
        wb.SheetNames.includes(`Shift-${shift.id}`) &&
        wb.SheetNames.includes('Product Sales') &&
        wb.SheetNames.includes('Variant Breakdown') &&
        wb.SheetNames.includes('Expenses'),
      'Excel workbook generated all 4 required sheets',
      `Sheets: ${wb.SheetNames.join(', ')}`,
    );

    const variantRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Variant Breakdown']);
    // In Order 1 & Order 2:
    // Salt Bread Original: 2 single + 1 bundle = 3 total pcs
    // Salt Bread Smoked Ham and Cheese: 0 single + 2 bundle = 2 total pcs
    // Thai Milk Tea: 0 single + 2 bundle = 2 total pcs
    // Thai Tea Honey Lemon: 1 single + 0 bundle = 1 total pc
    // Salt Bread Double Chocolate: 0 single + 1 bundle = 1 total pc
    const origRow = variantRows.find((r) => r['Flavor / Variant Name'] === 'Salt Bread Original');
    const hamRow = variantRows.find((r) => r['Flavor / Variant Name'] === 'Salt Bread Smoked Ham and Cheese');
    assert(
      Boolean(
        origRow &&
          origRow['Single Items Sold (pcs)'] === 2 &&
          origRow['Bundle Box Contents (pcs)'] === 1 &&
          origRow['TOTAL PIECES SOLD (pcs)'] === 3 &&
          hamRow &&
          hamRow['Single Items Sold (pcs)'] === 0 &&
          hamRow['Bundle Box Contents (pcs)'] === 2 &&
          hamRow['TOTAL PIECES SOLD (pcs)'] === 2,
      ),
      'Excel "Variant Breakdown" sheet accurately combines Single Items Sold + Bundle Box Contents',
      `Salt Bread Original: 2 single + 1 bundle = 3 pcs | Smoked Ham: 0 single + 2 bundle = 2 pcs`,
    );

    // Close Shift
    const closed = await closeShiftService(shift.id, expectedCash, 'Kasir Bazaar iPad');
    assert(
      closed.expectedCash === 377_000 && closed.actualCash === 377_000,
      'Shift closed with zero cash drawer discrepancy',
    );

    // -------------------------------------------------------------
    // 9. FINAL CLEAN RESET TO INITIAL 8 PRODUCTS FOR PRODUCTION
    // -------------------------------------------------------------
    console.log('\n📌 PHASE 9: Resetting Database to Clean Initial 8-Product State for Production');
    await seedCleanInitialProducts();

    const finalProducts = await prisma.product.findMany({ orderBy: { id: 'asc' } });
    const finalBundles = await prisma.product.count({ where: { isBundle: true } });
    const finalTrx = await prisma.transaction.count();
    const finalShifts = await prisma.shift.count();
    const finalExpenses = await prisma.expense.count();
    const finalLogs = await prisma.inventoryLog.count();

    assert(
      finalProducts.length === 8 &&
        finalBundles === 0 &&
        finalTrx === 0 &&
        finalShifts === 0 &&
        finalExpenses === 0 &&
        finalLogs === 0,
      'Database restored to 100% clean state with ONLY the 8 requested products',
    );

    console.log('\n================================================================');
    console.log(`🎯 PRODUCTION READINESS RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('================================================================');
  } catch (err) {
    console.error('💥 Error during production audit test:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runBazaarProductionReadinessAudit();
