const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  const items = await prisma.transactionItem.findMany();
  for (const item of items) {
    if (item.productId) {
      const p = await prisma.product.findUnique({ where: { id: item.productId } });
      if (p) {
        await prisma.transactionItem.update({
          where: { id: item.id },
          data: { costPrice: p.costPrice }
        });
      }
    }
  }
  console.log('Backfill complete!');
}

backfill();
