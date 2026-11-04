import { connection } from 'next/server';
import ProductForm from '@/components/ProductForm';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const resolvedParams = await params;
  const id = Number(resolvedParams.id);
  
  if (isNaN(id)) notFound();

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        type: true,
        variant: true,
        images: true,
      },
    }),
    prisma.productType.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  if (product.isBundle) {
    redirect(`/bundles/${product.id}/edit`);
  }

  return <ProductForm initialData={product} categories={categories} />;
}
