import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Main product: Artisan Korean Saltbread with multiple priced variants
  const saltbreadItem = {
    name: 'Korean Saltbread (Fresh Baked)',
    costPrice: 7000,
    price: 15000,
    stock: 70,
    type: 'Saltbread',
    description: 'Crispy outer crust, tender butter-infused center topped with coarse sea salt crystals.',
    variants: [
      { name: 'Original Sea Salt', price: 15000, costPrice: 6500, stock: 25, bundleUpcharge: 0 },
      { name: 'Garlic Butter', price: 18000, costPrice: 8000, stock: 18, bundleUpcharge: 0 },
      { name: 'Double Cheese Melt', price: 20000, costPrice: 9000, stock: 15, bundleUpcharge: 0 },
      { name: 'Dark Chocolate Melt', price: 20000, costPrice: 8500, stock: 12, bundleUpcharge: 0 },
      { name: 'Truffle Ham & Cheese', price: 24000, costPrice: 12500, stock: 10, bundleUpcharge: 3000 },
    ],
  };

  const bundles = [
    {
      name: 'Box of 3 (Bundle Package)',
      costPrice: 24000,
      price: 48000,
      stock: 30,
      type: 'Bundling',
      isBundle: true,
      bundleQuota: 3,
      description: 'Choose any 3 saltbread flavors in a luxury bakery gift box.',
    },
    {
      name: 'Box of 6 Family Pack (Bundle Package)',
      costPrice: 48000,
      price: 92000,
      stock: 20,
      type: 'Bundling',
      isBundle: true,
      bundleQuota: 6,
      description: 'Choose any 6 saltbread flavors to share with family and friends.',
    },
  ];

  // Upsert the main Saltbread product
  const existingSaltbread = await prisma.product.findFirst({ where: { name: saltbreadItem.name } });
  let saltbreadId: number;

  if (existingSaltbread) {
    saltbreadId = existingSaltbread.id;
    await prisma.product.update({
      where: { id: saltbreadId },
      data: {
        costPrice: saltbreadItem.costPrice,
        price: saltbreadItem.price,
        stock: saltbreadItem.variants.reduce((sum, v) => sum + v.stock, 0),
        description: saltbreadItem.description,
        isActive: true,
      },
    });
  } else {
    const created = await prisma.product.create({
      data: {
        name: saltbreadItem.name,
        costPrice: saltbreadItem.costPrice,
        price: saltbreadItem.price,
        stock: saltbreadItem.variants.reduce((sum, v) => sum + v.stock, 0),
        description: saltbreadItem.description,
        priority: 100,
        isActive: true,
        type: {
          connectOrCreate: {
            where: { name: saltbreadItem.type },
            create: { name: saltbreadItem.type },
          },
        },
      },
    });
    saltbreadId = created.id;
  }

  // Upsert Variant Options
  for (let i = 0; i < saltbreadItem.variants.length; i++) {
    const v = saltbreadItem.variants[i];
    const existingVariant = await prisma.productVariantOption.findFirst({
      where: { productId: saltbreadId, name: v.name },
    });

    if (existingVariant) {
      await prisma.productVariantOption.update({
        where: { id: existingVariant.id },
        data: {
          price: v.price,
          costPrice: v.costPrice,
          stock: v.stock,
          bundleUpcharge: v.bundleUpcharge,
          priority: saltbreadItem.variants.length - i,
          isActive: true,
        },
      });
    } else {
      await prisma.productVariantOption.create({
        data: {
          productId: saltbreadId,
          name: v.name,
          price: v.price,
          costPrice: v.costPrice,
          stock: v.stock,
          bundleUpcharge: v.bundleUpcharge,
          priority: saltbreadItem.variants.length - i,
          isActive: true,
        },
      });
    }
  }

  // Upsert Bundles
  for (const b of bundles) {
    const existingBundle = await prisma.product.findFirst({ where: { name: b.name } });
    if (existingBundle) {
      await prisma.product.update({
        where: { id: existingBundle.id },
        data: {
          costPrice: b.costPrice,
          price: b.price,
          stock: b.stock,
          isBundle: true,
          bundleQuota: b.bundleQuota,
          description: b.description,
          isActive: true,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: b.name,
          costPrice: b.costPrice,
          price: b.price,
          stock: b.stock,
          isBundle: true,
          bundleQuota: b.bundleQuota,
          description: b.description,
          priority: 90,
          isActive: true,
          type: {
            connectOrCreate: {
              where: { name: b.type },
              create: { name: b.type },
            },
          },
        },
      });
    }
  }

  console.log('Seeded Saltbread master variants and bundles successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
