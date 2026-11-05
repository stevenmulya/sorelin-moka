import { prisma } from '../src/lib/prisma';

export const INITIAL_BAZAAR_PRODUCTS = [
  {
    name: 'Salt Bread Original',
    category: 'Saltbread',
    price: 18000,
    costPrice: 13000,
    stock: 0,
    priority: 10,
    isBestSeller: true,
    isFavorite: true,
    description: 'Classic artisanal Korean saltbread with French butter and flaky sea salt crystals.',
  },
  {
    name: 'Salt Bread Garlic Butter',
    category: 'Saltbread',
    price: 20000,
    costPrice: 14000,
    stock: 0,
    priority: 9,
    isBestSeller: true,
    isFavorite: false,
    description: 'Infused with roasted garlic butter and parsley for a savory aroma.',
  },
  {
    name: 'Salt Bread Kinako Ogura Mochi',
    category: 'Saltbread',
    price: 22000,
    costPrice: 14000,
    stock: 0,
    priority: 8,
    isBestSeller: false,
    isFavorite: false,
    description: 'Filled with sweet red bean (ogura) and chewy mochi, dusted with fragrant kinako.',
  },
  {
    name: 'Salt Bread Double Cheese Honey',
    category: 'Saltbread',
    price: 23000,
    costPrice: 16000,
    stock: 0,
    priority: 7,
    isBestSeller: false,
    isFavorite: true,
    description: 'Stuffed with melted cheddar and mozzarella, drizzled with pure floral honey.',
  },
  {
    name: 'Salt Bread Double Chocolate',
    category: 'Saltbread',
    price: 23000,
    costPrice: 17000,
    stock: 0,
    priority: 6,
    isBestSeller: false,
    isFavorite: false,
    description: 'Filled with rich Belgian dark chocolate that melts when warmed.',
  },
  {
    name: 'Salt Bread Smoked Ham and Cheese',
    category: 'Saltbread',
    price: 25000,
    costPrice: 20000,
    stock: 0,
    priority: 5,
    isBestSeller: true,
    isFavorite: false,
    description: 'Savory smoked ham, melted mozzarella, and fragrant glaze.',
  },
  {
    name: 'Thai Milk Tea',
    category: 'Beverage',
    price: 15000,
    costPrice: 7000,
    stock: 0,
    priority: 10,
    isBestSeller: true,
    isFavorite: false,
    description: 'Authentic brewed Thai tea with sweet condensed milk over ice.',
  },
  {
    name: 'Thai Tea Honey Lemon',
    category: 'Beverage',
    price: 15000,
    costPrice: 7000,
    stock: 0,
    priority: 9,
    isBestSeller: false,
    isFavorite: true,
    description: 'Refreshing iced tea with natural honey and fresh squeezed lemon.',
  },
] as const;

export async function seedCleanInitialProducts() {
  console.log('🧹 Clearing all existing seed, transaction, shift, and catalog data...');

  await prisma.transactionItem.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.inventoryLog.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.productVariantOption.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productType.deleteMany({});

  console.log('🌱 Creating categories (Saltbread & Beverage)...');
  const catSaltbread = await prisma.productType.create({ data: { name: 'Saltbread' } });
  const catBeverage = await prisma.productType.create({ data: { name: 'Beverage' } });

  const categoryMap: Record<string, number> = {
    Saltbread: catSaltbread.id,
    Beverage: catBeverage.id,
  };

  console.log('🥖 Seeding 8 official initial products (Stock = 0)...');
  for (const item of INITIAL_BAZAAR_PRODUCTS) {
    await prisma.product.create({
      data: {
        name: item.name,
        typeId: categoryMap[item.category],
        price: item.price,
        costPrice: item.costPrice,
        stock: item.stock,
        priority: item.priority,
        isBestSeller: item.isBestSeller,
        isFavorite: item.isFavorite,
        isBundle: false,
        bundleQuota: 0,
        isActive: true,
        description: item.description,
      },
    });
    console.log(
      `   ✅ [${item.category}] ${item.name} — Jual: Rp ${item.price.toLocaleString('id-ID')} | Modal: Rp ${item.costPrice.toLocaleString('id-ID')} | Stock: ${item.stock}`,
    );
  }

  const totalProducts = await prisma.product.count();
  const totalBundles = await prisma.product.count({ where: { isBundle: true } });
  console.log(`\n🎉 Clean seed complete! Total products: ${totalProducts} (Bundles: ${totalBundles}, Initial Stock: 0).`);
}

if (require.main === module) {
  seedCleanInitialProducts()
    .catch((e) => {
      console.error('❌ Seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
