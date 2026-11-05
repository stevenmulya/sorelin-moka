import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import BundleForm from '@/components/BundleForm';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function EditBundlePage(props: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const resolvedParams = await props.params;
  const bundleId = Number(resolvedParams.id);
  if (isNaN(bundleId)) notFound();

  const [bundle, categories, singleProducts] = await Promise.all([
    prisma.product.findUnique({
      where: { id: bundleId, isBundle: true },
      include: { images: true },
    }),
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

  if (!bundle) notFound();

  return (
    <BundleForm
      initialData={bundle}
      categories={categories}
      availableProducts={singleProducts}
    />
  );
}
