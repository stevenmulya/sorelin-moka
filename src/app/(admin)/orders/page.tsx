import { prisma } from '@/lib/prisma';
import OrderActions from '@/components/OrderActions';
import AutoRefresh from '@/components/AutoRefresh';
import { ChefHat } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { connection } from 'next/server';
import { getActiveShift } from '@/lib/services/shifts';
import { STATUS } from '@/lib/constants';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function OrdersPage() {
  await connection();
  const activeShift = await getActiveShift();

  const orders = await prisma.transaction.findMany({
    where: {
      status: { in: [STATUS.PREPARING, STATUS.READY] },
      shiftId: activeShift ? activeShift.id : -1,
    },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AutoRefresh seconds={10} />

      <div>
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Active Orders (Kitchen)</h1>
        <p className="text-sm text-[#8E6D53] mt-1">Manage orders being prepared or ready for pickup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {orders.map((order) => (
          <div
            key={order.id}
            className={`bg-[#FFFDF8] rounded-2xl border p-5 shadow-xs flex flex-col ${
              order.status === STATUS.READY ? 'border-[#C88A32] bg-[#FAF0DA]/20' : 'border-[#E5D5BC]'
            }`}
          >
            <div className="flex items-start justify-between border-b border-[#E5D5BC]/60 pb-4 mb-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {order.selfieUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={order.selfieUrl}
                    alt={order.customer}
                    className="w-10 h-10 rounded-full object-cover border border-[#E5D5BC] flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#FAF0DA] border border-[#E5D5BC] text-[#6B4227] font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {(order.customer || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ChefHat className={`h-4 w-4 ${order.status === STATUS.READY ? 'text-[#C88A32]' : 'text-[#6B4227]'}`} />
                    <h3 className="font-bold text-sm sm:text-base text-[#6B4227] truncate">
                      {generateTrxCode(order.id, order.createdAt, order.customer)}
                    </h3>
                  </div>
                  <p className="text-xs text-[#8E6D53] mt-0.5 truncate">
                    Customer: <span className="font-semibold text-[#3F2311]">{order.customer}</span>
                  </p>
                </div>
              </div>
              <StatusBadge status={order.status} className="flex-shrink-0" />
            </div>

            <div className="flex-1">
              <div className="mb-4">
                <span className="block text-xs font-semibold text-[#8E6D53] mb-2">Order Items</span>
                {order.items && order.items.length > 0 ? (
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-bold text-[#6B4227] mr-2">{item.quantity}x</span>
                          <span className="text-[#3F2311] font-medium">{item.productName}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#8E6D53] italic">No item details.</p>
                )}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[#E5D5BC]/60">
              <OrderActions id={order.id} status={order.status} />
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full bg-[#FFFDF8] rounded-2xl border border-dashed border-[#E5D5BC] p-12 text-center">
            <ChefHat className="h-10 w-10 text-[#9E826B] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[#6B4227]">No Active Orders</h3>
            <p className="text-sm text-[#8E6D53] mt-1">Paid orders (Preparing) will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
