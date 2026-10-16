import ProductForm from '@/components/ProductForm';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = Number(resolvedParams.id);
  
  if (isNaN(id)) notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: { type: true, variant: true, images: true }
  });

  if (!product) notFound();

  return <ProductForm initialData={product} />;
}
