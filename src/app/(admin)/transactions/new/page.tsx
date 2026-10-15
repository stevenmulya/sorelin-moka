import { prisma } from '@/lib/prisma';
import CheckoutForm from '@/components/CheckoutForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { connection } from 'next/server';

export const instant = false;

export default async function NewTransactionPage() {
  await connection();
  const [products, activeShift] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { images: { take: 1 }, type: true }
    }),
    prisma.shift.findFirst({
      where: { status: 'Open' }
    })
  ]);

  if (!activeShift) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 text-center py-20">
        <h1 className="text-2xl font-bold text-[#4A2E1B]">Shift is Closed</h1>
        <p className="text-[#7A6251]">You must open a shift before you can make transactions.</p>
        <Link href="/shift" className="inline-block mt-4 px-6 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold hover:bg-[#3D2413] transition-colors shadow-xs">
          Go to Shift Management
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/transactions" className="p-2.5 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2] transition-colors shadow-xs">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">New Order (POS)</h1>
          <p className="text-sm text-[#7A6251] mt-1">Select products and checkout.</p>
        </div>
      </div>

      <CheckoutForm products={products} />
    </div>
  );
}
