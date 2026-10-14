import { prisma } from '@/lib/prisma';
import KioskFlow from '@/components/KioskFlow';
import { Store } from 'lucide-react';
import { connection } from 'next/server';

export const instant = false;

export default async function KioskPage() {
  await connection();
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
  });

  if (!activeShift) {
    return (
      <div className="h-[100dvh] bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 bg-[#FDF3D8] text-[#8C6418] rounded-2xl flex items-center justify-center mb-4 border border-[#F2DC9B] shadow-xs">
          <Store className="w-7 h-7" />
        </div>
        <h1 className="text-base sm:text-lg font-bold text-[#3B2314] mb-1.5 tracking-tight">Store is Closed</h1>
        <p className="text-xs sm:text-sm text-[#7A6251] max-w-sm mb-6 leading-relaxed">
          The self-ordering kiosk is currently unavailable because the cashier shift is not open yet. Please contact our staff.
        </p>
        <div className="px-4 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-full text-xs font-medium text-[#6B5344] shadow-xs">
          Cashier Status: <span className="text-[#8C6418] font-semibold">Shift Closed</span>
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
    orderBy: { priority: 'desc' },
  });

  return <KioskFlow products={products} />;
}
