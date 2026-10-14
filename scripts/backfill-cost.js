const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  try {
    const items = await prisma.transactionItem.findMany();
    let updated = 0;
    for (const item of items) {
      if (item.productId && (item.costPrice === 0 || item.costPrice == null)) {
        const p = await prisma.product.findUnique({ where: { id: item.productId } });
        if (p) {
          await prisma.transactionItem.update({
            where: { id: item.id },
            data: { costPrice: p.costPrice }
          });
          updated++;
        }
      }
    }
    console.log(`Backfill complete! Updated ${updated} items.`);
  } catch (e) {
    console.error('Backfill error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

backfill();
