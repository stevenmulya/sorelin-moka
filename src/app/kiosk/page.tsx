import { PrismaClient } from '@prisma/client';
import KioskFlow from '@/components/KioskFlow';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

export const instant = false;

export default async function KioskPage() {
  const products = await prisma.product.findMany({
    include: {
      type: true,
      variant: true,
      images: true,
    },
    orderBy: { priority: 'asc' },
  });

  return <KioskFlow products={products} />;
}
