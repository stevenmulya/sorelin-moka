import { prisma } from '@/lib/prisma';
import CheckoutForm from '@/components/CheckoutForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { connection } from 'next/server';
import { getActiveShift } from '@/lib/services/shifts';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function NewTransactionPage() {
  await connection();
  const [products, activeShift] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      include: { images: { take: 1 }, type: true, variant: true },
    }),
    getActiveShift(),
  ]);

  if (!activeShift) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 text-center py-20">
        <h1 className="text-2xl font-bold text-[#6B4227]">Shift is Closed</h1>
        <p className="text-[#8E6D53]">You must open a shift before you can process transactions.</p>
        <Link
          href="/shift"
          className="inline-block mt-4 px-6 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold hover:bg-[#54311B] transition-colors shadow-xs"
        >
          Go to Shift Management
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/transactions"
          className="p-2.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA] transition-colors shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">New Order (POS)</h1>
          <p className="text-sm text-[#8E6D53] mt-1">Select products and complete checkout.</p>
        </div>
      </div>

      <CheckoutForm products={products} />
    </div>
  );
}
