import { prisma } from '../src/lib/prisma';
import { serializeBundleConfig } from '../src/lib/bundle-config';

export async function seedBazaarMenu() {
  console.log('🌱 Setting up Sorelin 5-Day Bazaar Menu (Clean & Deduplicated)...');

  // 1. Ensure Categories: Saltbread & Beverage
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

  console.log(`✅ Verified categories: "${catSaltbread.name}" (ID: ${catSaltbread.id}) & "${catBeverage.name}" (ID: ${catBeverage.id})`);

  // 2. Define the exact 6 Saltbread Products (Range 18k - 24k)
  const saltbreadItems = [
    {
      name: 'Salt Bread Original',
      typeId: catSaltbread.id,
      price: 18000,
      costPrice: 7000,
      stock: 60,
      priority: 10,
      isBestSeller: true,
      isFavorite: true,
      description: 'Classic artisanal Korean saltbread with French butter and flaky sea salt crystals.',
    },
    {
      name: 'Salt Bread Garlic Butter',
      typeId: catSaltbread.id,
      price: 20000,
      costPrice: 7000,
      stock: 45,
      priority: 9,
      isBestSeller: true,
      description: 'Infused with roasted garlic butter and parsley for a savory aroma.',
    },
    {
      name: 'Salt Bread Kinako Ogura Mochi',
      typeId: catSaltbread.id,
      price: 22000,
      costPrice: 7000,
      stock: 40,
      priority: 8,
      description: 'Filled with sweet red bean (ogura) and chewy mochi, dusted with fragrant kinako.',
    },
    {
      name: 'Salt Bread Double Cheese Honey',
      typeId: catSaltbread.id,
      price: 23000,
      costPrice: 7000,
      stock: 45,
      priority: 7,
      isFavorite: true,
      description: 'Stuffed with melted cheddar and mozzarella, drizzled with pure floral honey.',
    },
    {
      name: 'Salt Bread Double Chocolate',
      typeId: catSaltbread.id,
      price: 23000,
      costPrice: 7000,
      stock: 40,
      priority: 6,
      description: 'Filled with rich Belgian dark chocolate that melts when warmed.',
    },
    {
      name: 'Salt Bread Smoked Ham and Cheese',
      typeId: catSaltbread.id,
      price: 24000,
      costPrice: 7000,
      stock: 35,
      priority: 5,
      isBestSeller: true,
      description: 'Savory smoked ham, melted mozzarella, and fragrant glaze.',
    },
  ];

  // 3. Define the exact 2 Beverage Products (15k each)
  const beverageItems = [
    {
      name: 'Thai Milk Tea',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 7000,
      stock: 60,
      priority: 10,
      isBestSeller: true,
      description: 'Authentic brewed Thai tea with sweet condensed milk over ice.',
    },
    {
      name: 'Thai Tea Honey Lemon',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 7000,
      stock: 60,
      priority: 9,
      isFavorite: true,
      description: 'Refreshing iced tea with natural honey and fresh squeezed lemon.',
    },
  ];

  // 4. Define Bundle A & Bundle B configurations
  const bundleAConfig = serializeBundleConfig({
    slots: [
      { id: 'slot-saltbread-a', type: 'CATEGORY', categoryName: 'Saltbread', quota: 2 },
      { id: 'slot-beverage-a', type: 'CATEGORY', categoryName: 'Beverage', quota: 1 },
    ],
  });

  const bundleBConfig = serializeBundleConfig({
    slots: [
      { id: 'slot-saltbread-b', type: 'CATEGORY', categoryName: 'Saltbread', quota: 5 },
      { id: 'slot-beverage-b', type: 'CATEGORY', categoryName: 'Beverage', quota: 3 },
    ],
  });

  const bundleItems = [
    {
      name: 'Bundle A (2 Saltbread + 1 Beverage)',
      price: 45000, // Base price (hemat dari 18+18+15 = 51k)
      costPrice: 21000,
      stock: 0,
      isBundle: true,
      bundleQuota: 3,
      priority: 10,
      availableVariants: bundleAConfig,
      isBestSeller: true,
      description: 'Paket combo hemat: Bebas pilih 2 Saltbread + 1 Minuman dingin favoritmu!',
    },
    {
      name: 'Bundle B (5 Saltbread + 3 Beverage)',
      price: 115000, // Base price (hemat dari 18*5 + 15*3 = 135k)
      costPrice: 56000,
      stock: 0,
      isBundle: true,
      bundleQuota: 8,
      priority: 9,
      availableVariants: bundleBConfig,
      isFavorite: true,
      description: 'Paket pesta combo hemat: Bebas pilih 5 Saltbread + 3 Minuman dingin segar!',
    },
  ];

  // 5. Deactivate ALL existing products first to guarantee zero ghost duplicates
  await prisma.product.updateMany({
    data: { isActive: false },
  });

  // 6. Idempotent Upsert for Saltbread
  for (const item of saltbreadItems) {
    const existing = await prisma.product.findFirst({
      where: { name: item.name },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...item, isActive: true },
      });
      console.log(`   🍞 [Saltbread Updated] ${item.name} - Rp ${item.price} (Stock: ${item.stock})`);
    } else {
      await prisma.product.create({
        data: { ...item, isActive: true },
      });
      console.log(`   🍞 [Saltbread Created] ${item.name} - Rp ${item.price} (Stock: ${item.stock})`);
    }
  }

  // 7. Idempotent Upsert for Beverages
  for (const item of beverageItems) {
    const existing = await prisma.product.findFirst({
      where: { name: item.name },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...item, isActive: true },
      });
      console.log(`   🥤 [Beverage Updated] ${item.name} - Rp ${item.price} (Stock: ${item.stock})`);
    } else {
      await prisma.product.create({
        data: { ...item, isActive: true },
      });
      console.log(`   🥤 [Beverage Created] ${item.name} - Rp ${item.price} (Stock: ${item.stock})`);
    }
  }

  // 8. Idempotent Upsert for Bundle A & Bundle B
  for (const item of bundleItems) {
    const existing = await prisma.product.findFirst({
      where: { name: item.name },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...item, isActive: true },
      });
      console.log(`   📦 [Bundle Updated] ${item.name} - Rp ${item.price} (Stock: 0/Dynamic)`);
    } else {
      await prisma.product.create({
        data: { ...item, isActive: true },
      });
      console.log(`   📦 [Bundle Created] ${item.name} - Rp ${item.price} (Stock: 0/Dynamic)`);
    }
  }

  // 9. Extra safety: Archive any other product that is active but not in this official 10-item catalog
  const officialNames = [
    ...saltbreadItems.map((i) => i.name),
    ...beverageItems.map((i) => i.name),
    ...bundleItems.map((i) => i.name),
  ];
  await prisma.product.updateMany({
    where: {
      name: { notIn: officialNames },
      isActive: true,
    },
    data: { isActive: false },
  });

  const activeCount = await prisma.product.count({ where: { isActive: true } });
  console.log(`\n🎉 Bazaar catalog successfully seeded! Total active products: ${activeCount} (Expected: 10, zero duplicates).`);
}

// Allow direct CLI execution
if (require.main === module) {
  seedBazaarMenu()
    .catch((err) => {
      console.error('❌ Seeder failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
