import { prisma } from '../src/lib/prisma';
import { serializeBundleConfig } from '../src/lib/bundle-config';

async function seedBazaarMenu() {
  console.log('🌱 Setting up Sorelin 5-Day Bazaar Menu...');

  // 1. Deactivate old demo / scratch products
  await prisma.product.updateMany({
    data: { isActive: false },
  });
  console.log('✅ Archived previous scratch/demo products.');

  // 2. Ensure Categories: Saltbread & Beverage
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

  console.log(`✅ Verified categories: "${catSaltbread.name}" and "${catBeverage.name}"`);

  // 3. Insert the 6 Saltbread Products (Range 18k - 26k)
  const saltbreads = [
    {
      name: 'Original Sea Saltbread',
      typeId: catSaltbread.id,
      price: 18000,
      costPrice: 7000,
      stock: 60,
      isBestSeller: true,
      isFavorite: true,
      description: 'Classic artisanal Korean saltbread with French butter and flaky sea salt crystals.',
    },
    {
      name: 'Garlic Butter Saltbread',
      typeId: catSaltbread.id,
      price: 20000,
      costPrice: 8000,
      stock: 45,
      isBestSeller: true,
      description: 'Infused with roasted garlic butter and parsley for a savory aroma.',
    },
    {
      name: 'Double Cheese Melt Saltbread',
      typeId: catSaltbread.id,
      price: 22000,
      costPrice: 9000,
      stock: 45,
      isFavorite: true,
      description: 'Stuffed with sharp cheddar and mozzarella for the ultimate cheese pull.',
    },
    {
      name: 'Dark Chocolate Melt Saltbread',
      typeId: catSaltbread.id,
      price: 22000,
      costPrice: 9000,
      stock: 40,
      description: 'Filled with rich Belgian 70% dark chocolate that melts when warmed.',
    },
    {
      name: 'Truffle Mushroom Saltbread',
      typeId: catSaltbread.id,
      price: 24000,
      costPrice: 10000,
      stock: 35,
      description: 'Sautéed champignon mushrooms with white truffle oil and sea salt.',
    },
    {
      name: 'Truffle Ham & Cheese Saltbread',
      typeId: catSaltbread.id,
      price: 26000,
      costPrice: 11000,
      stock: 35,
      isBestSeller: true,
      isFavorite: true,
      description: 'Savory smoked ham, melted mozzarella, and fragrant truffle glaze.',
    },
  ];

  for (const s of saltbreads) {
    const p = await prisma.product.create({
      data: { ...s, isActive: true },
    });
    console.log(`   🍞 [Saltbread] ${p.name} - Rp ${p.price.toLocaleString('id-ID')} (Stock: ${p.stock})`);
  }

  // 4. Insert the 2 Beverages (15k each)
  const beverages = [
    {
      name: 'Thai Tea',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 5000,
      stock: 60,
      isBestSeller: true,
      description: 'Authentic brewed Thai tea with sweet condensed milk over ice.',
    },
    {
      name: 'Thai Lemonade',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 5000,
      stock: 60,
      isFavorite: true,
      description: 'Refreshing iced lemonade with Thai lime juice and lemongrass hints.',
    },
  ];

  for (const b of beverages) {
    const p = await prisma.product.create({
      data: { ...b, isActive: true },
    });
    console.log(`   🥤 [Beverage] ${p.name} - Rp ${p.price.toLocaleString('id-ID')} (Stock: ${p.stock})`);
  }

  // 5. Insert Universal Bundles (stock = 0, dynamic inventory!)
  const bundle2S1B = serializeBundleConfig({
    slots: [
      { id: 'slot-saltbread', type: 'CATEGORY', categoryName: 'Saltbread', quota: 2 },
      { id: 'slot-beverage', type: 'CATEGORY', categoryName: 'Beverage', quota: 1 },
    ],
  });

  const bundleBox3 = serializeBundleConfig({
    slots: [
      { id: 'slot-saltbread-3', type: 'CATEGORY', categoryName: 'Saltbread', quota: 3 },
    ],
  });

  const bundleBox6 = serializeBundleConfig({
    slots: [
      { id: 'slot-saltbread-6', type: 'CATEGORY', categoryName: 'Saltbread', quota: 6 },
    ],
  });

  const bundles = [
    {
      name: 'Bundle 2 Saltbread + 1 Beverage',
      price: 45000, // Termurah: 18k + 18k + 15k = 51k -> Paket Hemat 45k
      costPrice: 19000,
      stock: 0,
      isBundle: true,
      bundleQuota: 3,
      availableVariants: bundle2S1B,
      isBestSeller: true,
      description: 'Paket combo hemat: Bebas pilih 2 Saltbread + 1 Minuman dingin favoritmu!',
    },
    {
      name: 'Box of 3 Saltbread (Hemat)',
      price: 50000, // Termurah: 18k * 3 = 54k -> Paket Hemat 50k
      costPrice: 21000,
      stock: 0,
      isBundle: true,
      bundleQuota: 3,
      availableVariants: bundleBox3,
      description: 'Kotak isi 3 Saltbread pilihanmu dengan kemasan gift box cantik.',
    },
    {
      name: 'Box of 6 Family Pack (Super Hemat)',
      price: 99000, // Termurah: 18k * 6 = 108k -> Paket Hemat 99k
      costPrice: 42000,
      stock: 0,
      isBundle: true,
      bundleQuota: 6,
      availableVariants: bundleBox6,
      isFavorite: true,
      description: 'Paket keluarga isi 6 Saltbread pilihan dengan kemasan exclusive box Sorelin.',
    },
  ];

  for (const b of bundles) {
    const p = await prisma.product.create({
      data: { ...b, isActive: true },
    });
    console.log(`   📦 [Bundle] ${p.name} - Rp ${p.price.toLocaleString('id-ID')} (Base: 45k, Stock: Dynamic)`);
  }

  console.log('\n✨ Sorelin Bazaar Catalog Successfully Seeded!');
  console.log('Categories visible on Kiosk:');
  console.log('1. All');
  console.log('2. Saltbread (6 varieties)');
  console.log('3. Beverage (2 varieties)');
  console.log('4. 📦 Bundle (3 package combos with dynamic stock & tier upcharges)');
}

seedBazaarMenu()
  .catch((e) => {
    console.error('❌ Error seeding menu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
