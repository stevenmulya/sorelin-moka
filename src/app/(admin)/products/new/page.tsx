import { connection } from 'next/server';
import { prisma } from '@/lib/prisma';
import ProductForm from '@/components/ProductForm';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
export const instant = false;

export default async function NewProductPage() {
  await connection();
  const categories = await prisma.productType.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return <ProductForm categories={categories} />;
}
