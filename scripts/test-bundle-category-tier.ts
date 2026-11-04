import { prisma } from '../src/lib/prisma';
import { openShiftService, closeShiftService } from '../src/lib/services/shifts';
import { createOrder, approvePaymentService } from '../src/lib/services/orders';
import { serializeBundleConfig } from '../src/lib/bundle-config';

async function main() {
  console.log('================================================================');
  console.log('🧪 TESTING DYNAMIC CATEGORIES & TIER UPCHARGES FOR BUNDLES');
  console.log('================================================================\n');

  // 1. Ensure clean shift
  const existingShift = await prisma.shift.findFirst({ where: { status: 'Open' } });
  if (existingShift) {
    await closeShiftService(existingShift.id, 100000, 'Kasir Clean');
  }

  const shift = await openShiftService('Kasir Test', 100000);
  console.log(`✅ Shift opened: ID #${shift.id}`);

  // 2. Setup dynamic Product Types / Categories
  const catSaltbread = await prisma.productType.upsert({
    where: { name: 'Saltbread' },
    update: {},
    create: { name: 'Saltbread' },
  });

  const catBeverage = await prisma.productType.upsert({
    where: { name: 'Beverage' },
    update: {},
    create: { name: 'Beverage' },
  });

  console.log(`✅ Categories verified: "${catSaltbread.name}" (ID: ${catSaltbread.id}) & "${catBeverage.name}" (ID: ${catBeverage.id})`);

  // 3. Create Saltbread Products (Range 18k - 24k)
  const saltOriginal = await prisma.product.create({
    data: {
      name: `Test Saltbread Original ${Date.now()}`,
      typeId: catSaltbread.id,
      price: 18000,
      costPrice: 8000,
      stock: 50,
      isActive: true,
    },
  });

  const saltHam = await prisma.product.create({
    data: {
      name: `Test Saltbread Truffle Ham ${Date.now()}`,
      typeId: catSaltbread.id,
      price: 24000,
      costPrice: 12000,
      stock: 30,
      isActive: true,
    },
  });

  // 4. Create Beverage Products (15k each)
  const drinkThaiTea = await prisma.product.create({
    data: {
      name: `Test Thai Tea ${Date.now()}`,
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 5000,
      stock: 40,
      isActive: true,
    },
  });

  const drinkLemonade = await prisma.product.create({
    data: {
      name: `Test Thai Lemonade ${Date.now()}`,
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 5000,
      stock: 40,
      isActive: true,
    },
  });

  console.log(`✅ Products created:`);
  console.log(`   - ${saltOriginal.name}: Rp ${saltOriginal.price} (Stock: ${saltOriginal.stock})`);
  console.log(`   - ${saltHam.name}: Rp ${saltHam.price} (Stock: ${saltHam.stock})`);
  console.log(`   - ${drinkThaiTea.name}: Rp ${drinkThaiTea.price} (Stock: ${drinkThaiTea.stock})`);
  console.log(`   - ${drinkLemonade.name}: Rp ${drinkLemonade.price} (Stock: ${drinkLemonade.stock})`);

  // 5. Create Bundle Package: 2 Saltbread + 1 Beverage (stock: 0 in DB!)
  const bundleConfig = serializeBundleConfig({
    slots: [
      { id: 'slot-salt', type: 'CATEGORY', categoryName: 'Saltbread', quota: 2 },
      { id: 'slot-bev', type: 'CATEGORY', categoryName: 'Beverage', quota: 1 },
    ],
  });

  const bundleProduct = await prisma.product.create({
    data: {
      name: `Bundle 2 Saltbread + 1 Beverage ${Date.now()}`,
      price: 45000, // Base bundle price (18 + 18 + 15 = 51k, discounted bundle price = 45k)
      costPrice: 21000,
      stock: 0, // ZERO STOCK IN DB: MUST BE DERIVED DYNAMICALLY FROM COMPONENTS!
      isBundle: true,
      bundleQuota: 3,
      availableVariants: bundleConfig,
      isActive: true,
    },
  });

  console.log(`✅ Bundle Product created with 0 manual stock: ${bundleProduct.name} (Base Price: Rp ${bundleProduct.price})`);

  // 6. Test Scenario A: Customer picks cheapest items (Original + Original + Thai Tea)
  // Expected price: Base Rp 45.000 + Rp 0 upcharge = Rp 45.000
  const orderAContents = `2x ${saltOriginal.name}, 1x ${drinkThaiTea.name}`;
  const orderA = await createOrder({
    customer: 'Budi Santoso',
    items: [
      {
        productId: bundleProduct.id,
        quantity: 1,
        isBundle: true,
        bundleContents: orderAContents,
      },
    ],
  });

  if (orderA.amount !== 45000) {
    throw new Error(`Order A total mismatch: expected 45000, got ${orderA.amount}`);
  }
  console.log(`✅ Order A (Cheapest Items): Total Rp ${orderA.amount} (Upcharge: Rp 0)`);

  // Approve Order A
  await approvePaymentService({
    transactionId: orderA.id,
    cashierName: 'Kasir Utama',
    paymentMethod: 'Cash',
    paidAmount: 50000,
  });

  // Verify stock deduction for Order A: 2x Original, 1x Thai Tea
  const origAfterA = await prisma.product.findUnique({ where: { id: saltOriginal.id } });
  const teaAfterA = await prisma.product.findUnique({ where: { id: drinkThaiTea.id } });
  if (origAfterA?.stock !== 48) throw new Error(`Original stock expected 48, got ${origAfterA?.stock}`);
  if (teaAfterA?.stock !== 39) throw new Error(`Thai tea stock expected 39, got ${teaAfterA?.stock}`);
  console.log(`✅ Order A stock deducted successfully: Original ${saltOriginal.stock} -> ${origAfterA.stock}, Thai Tea ${drinkThaiTea.stock} -> ${teaAfterA.stock}`);

  // 7. Test Scenario B: Customer picks 1 Original (18k, +0), 1 Truffle Ham (24k, +6k upcharge), 1 Thai Lemonade (15k, +0)
  // Expected price: 45.000 + 6.000 = 51.000
  const orderBContents = `1x ${saltOriginal.name}, 1x ${saltHam.name} (+Rp 6.000), 1x ${drinkLemonade.name}`;
  const orderB = await createOrder({
    customer: 'Citra Permata',
    items: [
      {
        productId: bundleProduct.id,
        quantity: 1,
        isBundle: true,
        bundleContents: orderBContents,
      },
    ],
  });

  if (orderB.amount !== 51000) {
    throw new Error(`Order B total mismatch: expected 51000 (45k + 6k), got ${orderB.amount}`);
  }
  console.log(`✅ Order B (Upcharge Tier): Total Rp ${orderB.amount} (45.000 + 6.000 upcharge) verified!`);

  // Approve Order B
  await approvePaymentService({
    transactionId: orderB.id,
    cashierName: 'Kasir Utama',
    paymentMethod: 'QRIS',
    paidAmount: 51000,
  });

  // Verify stock deduction for Order B: 1x Original, 1x Ham, 1x Lemonade
  const origAfterB = await prisma.product.findUnique({ where: { id: saltOriginal.id } });
  const hamAfterB = await prisma.product.findUnique({ where: { id: saltHam.id } });
  const lemAfterB = await prisma.product.findUnique({ where: { id: drinkLemonade.id } });

  if (origAfterB?.stock !== 47) throw new Error(`Original stock expected 47, got ${origAfterB?.stock}`);
  if (hamAfterB?.stock !== 29) throw new Error(`Ham stock expected 29, got ${hamAfterB?.stock}`);
  if (lemAfterB?.stock !== 39) throw new Error(`Lemonade stock expected 39, got ${lemAfterB?.stock}`);

  console.log(`✅ Order B stock deducted successfully:`);
  console.log(`   - Original: 48 -> ${origAfterB.stock} (-1)`);
  console.log(`   - Truffle Ham: 30 -> ${hamAfterB.stock} (-1)`);
  console.log(`   - Thai Lemonade: 40 -> ${lemAfterB.stock} (-1)`);

  // 8. Close Shift
  await closeShiftService(shift.id, 150000, 'Kasir Test');
  console.log(`✅ Shift closed cleanly.`);

  console.log('\n================================================================');
  console.log('🎉 ALL DYNAMIC BUNDLE CATEGORY & TIER UPCHARGE TESTS PASSED!');
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
