import ProductForm from '@/components/ProductForm';
import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

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
