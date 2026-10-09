import { PrismaClient } from '@prisma/client';
import CheckoutForm from '@/components/CheckoutForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { connection } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function NewTransactionPage() {
  await connection();
  const products = await prisma.product.findMany({
    orderBy: { name: 'asc' },
    include: { images: { take: 1 }, type: true }
  });
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' }
  });

  if (!activeShift) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900">Shift is Closed</h1>
        <p className="text-gray-500">You must open a shift before you can make transactions.</p>
        <Link href="/shift" className="inline-block mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">
          Go to Shift Management
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/transactions" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">New Transaction (POS)</h1>
          <p className="text-sm text-gray-500 mt-1">Select products and checkout.</p>
        </div>
      </div>

      <CheckoutForm products={products} />
    </div>
  );
}
