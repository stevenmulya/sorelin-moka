import { prisma } from '../src/lib/prisma';
import { serializeBundleConfig } from '../src/lib/bundle-config';

async function seedBazaarMenu() {
  console.log('🌱 Setting up Sorelin 5-Day Bazaar Menu (Official User Menu)...');

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

  console.log(`✅ Verified categories: "${catSaltbread.name}" (ID: ${catSaltbread.id}) & "${catBeverage.name}" (ID: ${catBeverage.id})`);

  // 3. Insert the exact 6 Saltbread Products (Range 18k - 24k, modal 7.000)
  const saltbreads = [
    {
      name: 'Salt Bread Original',
      typeId: catSaltbread.id,
      price: 18000,
      costPrice: 7000,
      stock: 60,
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
      isBestSeller: true,
      description: 'Infused with roasted garlic butter and parsley for a savory aroma.',
    },
    {
      name: 'Salt Bread Kinako Ogura Mochi',
      typeId: catSaltbread.id,
      price: 22000,
      costPrice: 7000,
      stock: 40,
      description: 'Filled with sweet red bean (ogura) and chewy mochi, dusted with fragrant kinako.',
    },
    {
      name: 'Salt Bread Double Cheese Honey',
      typeId: catSaltbread.id,
      price: 23000,
      costPrice: 7000,
      stock: 45,
      isFavorite: true,
      description: 'Stuffed with melted cheddar and mozzarella, drizzled with pure floral honey.',
    },
    {
      name: 'Salt Bread Double Chocolate',
      typeId: catSaltbread.id,
      price: 23000,
      costPrice: 7000,
      stock: 40,
      description: 'Filled with rich Belgian dark chocolate that melts when warmed.',
    },
    {
      name: 'Salt Bread Smoked Ham and Cheese',
      typeId: catSaltbread.id,
      price: 24000,
      costPrice: 7000,
      stock: 35,
      isBestSeller: true,
      description: 'Savory smoked ham, melted mozzarella, and fragrant glaze.',
    },
  ];

  for (const s of saltbreads) {
    const p = await prisma.product.create({
      data: { ...s, isActive: true },
    });
    console.log(`   🍞 [Saltbread] ${p.name} - Rp ${p.price.toLocaleString('id-ID')} (Stock: ${p.stock})`);
  }

  // 4. Insert the 2 Beverages (15k each, modal 7.000)
  const beverages = [
    {
      name: 'Thai Milk Tea',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 7000,
      stock: 60,
      isBestSeller: true,
      description: 'Authentic brewed Thai tea with sweet condensed milk over ice.',
    },
    {
      name: 'Thai Tea Honey Lemon',
      typeId: catBeverage.id,
      price: 15000,
      costPrice: 7000,
      stock: 60,
      isFavorite: true,
      description: 'Refreshing iced Thai tea with pure honey and fresh lemon juice.',
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
      costPrice: 21000,
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
    console.log(`   📦 [Bundle] ${p.name} - Rp ${p.price.toLocaleString('id-ID')} (Stock: Dynamic)`);
  }

  console.log('\n✨ Sorelin Bazaar Catalog Successfully Seeded with User Menu!');
}

seedBazaarMenu()
  .catch((e) => {
    console.error('❌ Error seeding menu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
