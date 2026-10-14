import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const saltbreads = [
    { name: 'Original Saltbread', costPrice: 7000, price: 15000, stock: 24, type: 'Saltbread', description: 'Classic buttery saltbread with sea salt.' },
    { name: 'Garlic Butter Saltbread', costPrice: 8500, price: 18000, stock: 15, type: 'Saltbread', description: 'Infused with roasted garlic and premium butter.' },
    { name: 'Truffle Mushroom Saltbread', costPrice: 12000, price: 25000, stock: 8, type: 'Saltbread', description: 'Premium saltbread with truffle oil and mushroom.' },
    { name: 'Cheese Melt Saltbread', costPrice: 9500, price: 20000, stock: 12, type: 'Saltbread', description: 'Stuffed with melted mozzarella and cheddar.' },
    { name: 'Matcha Cream Saltbread', costPrice: 10500, price: 22000, stock: 5, type: 'Saltbread', description: 'Sweet and savory with premium matcha cream.' },
    { name: 'Double Choco Saltbread', costPrice: 9500, price: 20000, stock: 10, type: 'Saltbread', description: 'Filled with rich dark chocolate ganache.' }
  ];

  for (let i = 0; i < saltbreads.length; i++) {
    const item = saltbreads[i];
    const existing = await prisma.product.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          costPrice: item.costPrice,
          price: item.price,
          description: item.description,
          isActive: true,
        }
      });
      console.log(`Updated product: ${item.name}`);
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          costPrice: item.costPrice,
          price: item.price,
          stock: item.stock,
          priority: saltbreads.length - i,
          description: item.description,
          isActive: true,
          type: {
            connectOrCreate: {
              where: { name: item.type },
              create: { name: item.type },
            },
          },
        },
      });
      console.log(`Created product: ${item.name}`);
    }
  }

  console.log('Seeded Saltbread products successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
