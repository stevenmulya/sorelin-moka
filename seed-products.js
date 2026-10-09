const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productsToAdd = [
    { name: "Takoyaki Original", typeName: "Food", variantName: "Snack", costPrice: 10000, price: 20000, stock: 50 },
    { name: "Sosis Bakar Jumbo", typeName: "Food", variantName: "Snack", costPrice: 8000, price: 15000, stock: 100 },
    { name: "Es Teh Manis", typeName: "Beverage", variantName: "Cold", costPrice: 2000, price: 5000, stock: 200 },
    { name: "Kopi Susu Gula Aren", typeName: "Beverage", variantName: "Coffee", costPrice: 7000, price: 18000, stock: 80 },
    { name: "Kentang Goreng", typeName: "Food", variantName: "Snack", costPrice: 6000, price: 15000, stock: 150 },
    { name: "Ayam Gunting Shihlin", typeName: "Food", variantName: "Main", costPrice: 15000, price: 30000, stock: 60 },
    { name: "Es Coklat Tambah Umur", typeName: "Beverage", variantName: "Cold", costPrice: 5000, price: 12000, stock: 120 },
    { name: "Dimsum Mentai", typeName: "Food", variantName: "Snack", costPrice: 12000, price: 25000, stock: 40 }
  ];

  for (const p of productsToAdd) {
    await prisma.product.create({
      data: {
        name: p.name,
        costPrice: p.costPrice,
        price: p.price,
        stock: p.stock,
        type: { connectOrCreate: { where: { name: p.typeName }, create: { name: p.typeName } } },
        variant: { connectOrCreate: { where: { name: p.variantName }, create: { name: p.variantName } } }
      }
    });
    console.log(`Added ${p.name}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
