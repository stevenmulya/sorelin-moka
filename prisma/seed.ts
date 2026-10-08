import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing
  await prisma.product.deleteMany()

  const saltbreads = [
    { name: 'Original Saltbread', price: 15000, stock: 24, category: 'Saltbread', description: 'Classic buttery saltbread with sea salt.' },
    { name: 'Garlic Butter Saltbread', price: 18000, stock: 15, category: 'Saltbread', description: 'Infused with roasted garlic and premium butter.' },
    { name: 'Truffle Mushroom Saltbread', price: 25000, stock: 8, category: 'Saltbread', description: 'Premium saltbread with truffle oil and mushroom.' },
    { name: 'Cheese Melt Saltbread', price: 20000, stock: 12, category: 'Saltbread', description: 'Stuffed with melted mozzarella and cheddar.' },
    { name: 'Matcha Cream Saltbread', price: 22000, stock: 5, category: 'Saltbread', description: 'Sweet and savory with premium matcha cream.' },
    { name: 'Double Choco Saltbread', price: 20000, stock: 10, category: 'Saltbread', description: 'Filled with rich dark chocolate ganache.' }
  ]

  for (const item of saltbreads) {
    await prisma.product.create({
      data: item
    })
  }

  console.log('Seeded Saltbread products!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
