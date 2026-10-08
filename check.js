const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const p = await prisma.product.findMany();
  console.log(p.map(x => ({ name: x.name, price: x.price, costPrice: x.costPrice })));
}
check();
