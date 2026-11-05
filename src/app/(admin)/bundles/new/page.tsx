import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import BundleForm from '@/components/BundleForm';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function NewBundlePage() {
  await connection();

  const [categories, singleProducts] = await Promise.all([
    prisma.productType.findMany({
      where: {
        NOT: { name: { in: ['Bundle', 'Bundling'] } },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, isBundle: false },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true,
        stock: true,
        type: { select: { name: true } },
      },
    }),
  ]);

  return (
    <BundleForm
      categories={categories}
      availableProducts={singleProducts}
    />
  );
}
