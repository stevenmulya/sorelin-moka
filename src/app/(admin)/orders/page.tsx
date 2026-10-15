import { prisma } from '@/lib/prisma';
import OrderActions from '@/components/OrderActions';
import AutoRefresh from '@/components/AutoRefresh';
import { ChefHat } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import { connection } from 'next/server';
import { STATUS } from '@/lib/constants';

export const instant = false;

export default async function OrdersPage() {
  await connection();
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' },
  });

  const orders = await prisma.transaction.findMany({
    where: { 
      status: { in: [STATUS.PREPARING, STATUS.READY] },
      shiftId: activeShift ? activeShift.id : -1,
    },
    orderBy: { createdAt: 'asc' },
    include: { items: true }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AutoRefresh seconds={10} />

      <div>
        <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Active Orders (Kitchen)</h1>
        <p className="text-sm text-[#7A6251] mt-1">Manage orders being prepared or ready for pickup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {orders.map(order => (
          <div key={order.id} className={`bg-[#FFFDF9] rounded-2xl border p-5 shadow-xs flex flex-col ${
            order.status === STATUS.READY ? 'border-purple-200 bg-purple-50/20' : 'border-[#EADBCC]'
          }`}>
            <div className="flex items-start justify-between border-b border-[#EADBCC]/60 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ChefHat className={`h-5 w-5 ${order.status === STATUS.READY ? 'text-purple-600' : 'text-blue-600'}`} />
                  <h3 className="font-bold text-base text-[#4A2E1B]">{generateTrxCode(order.id, order.createdAt, order.customer)}</h3>
                </div>
                <p className="text-sm text-[#7A6251] mt-1">Customer: <span className="font-semibold text-[#382213]">{order.customer}</span></p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            
            <div className="flex-1">
              <div className="mb-4">
                <span className="block text-xs font-semibold text-[#7A6251] uppercase tracking-wider mb-2">Order Items</span>
                {order.items && order.items.length > 0 ? (
                  <ul className="space-y-2">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-bold text-[#4A2E1B] mr-2">{item.quantity}x</span>
                          <span className="text-[#382213] font-medium">{item.productName}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#7A6251] italic">No item details.</p>
                )}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[#EADBCC]/60">
              <OrderActions id={order.id} status={order.status} />
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full bg-[#FFFDF9] rounded-2xl border border-dashed border-[#EADBCC] p-12 text-center">
            <ChefHat className="h-10 w-10 text-[#C4B2A2] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[#4A2E1B]">No Active Orders</h3>
            <p className="text-sm text-[#7A6251] mt-1">Paid orders (Preparing) will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
