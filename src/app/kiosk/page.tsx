import { prisma } from '@/lib/prisma';
import KioskFlow from '@/components/KioskFlow';
import { Store } from 'lucide-react';


export const instant = false;

export default async function KioskPage() {
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
  });

  if (!activeShift) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
          <Store className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Toko Belum Buka</h1>
        <p className="text-gray-500 max-w-md mb-8 text-lg">
          Kiosk pemesanan mandiri saat ini belum aktif karena kasir belum membuka shift hari ini. Silakan hubungi staf atau kasir.
        </p>
        <div className="px-6 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 shadow-sm">
          Status Kasir: <span className="text-amber-600 font-semibold">Shift Closed</span>
        </div>
      </div>
    );
  }

  const products = await prisma.product.findMany({
    include: {
      type: true,
      variant: true,
      images: true,
    },
    orderBy: { priority: 'desc' },
  });

  return <KioskFlow products={products} />;
}

