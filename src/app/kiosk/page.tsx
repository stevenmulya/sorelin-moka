import { prisma } from '@/lib/prisma';
import { getActiveShift } from '@/lib/services/shifts';
import KioskFlow from '@/components/KioskFlow';
import { Store } from 'lucide-react';
import { connection } from 'next/server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function KioskPage() {
  await connection();
  const activeShift = await getActiveShift();

  if (!activeShift) {
    return (
      <div className="h-[100dvh] bg-[#FAF0DA] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 bg-[#F3DBAA] text-[#6B4227] rounded-2xl flex items-center justify-center mb-4 border border-[#E5D5BC] shadow-xs">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-base sm:text-lg font-bold text-[#3F2311] mb-1.5 tracking-tight">Store is Closed</h1>
        <p className="text-xs sm:text-sm text-[#8E6D53] max-w-sm mb-6 leading-relaxed">
          Self-service ordering is currently unavailable because no cashier shift is open. Please contact our staff for assistance.
        </p>
        <div className="px-4 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-full text-xs font-medium text-[#6B4227] shadow-xs">
          Register Status: <span className="text-[#3F2311] font-semibold">Shift Closed</span>
        </div>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      type: true,
      variant: true,
      images: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  return <KioskFlow products={products} />;
}
