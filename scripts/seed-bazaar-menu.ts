import { prisma } from '../src/lib/prisma';
import { seedCleanInitialProducts } from '../prisma/seed';

export async function seedBazaarMenu() {
  await seedCleanInitialProducts();
}

if (require.main === module) {
  seedBazaarMenu()
    .catch((err) => {
      console.error('❌ Seeder failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
