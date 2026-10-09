import { PrismaClient } from '@prisma/client';
import OrderActions from '@/components/OrderActions';
import { ChefHat } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function OrdersPage() {
  const orders = await prisma.transaction.findMany({
    where: { 
      status: { in: ['Preparing', 'Ready for Pickup'] } 
    },
    orderBy: { createdAt: 'asc' },
    include: { items: true }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Active Orders (Kitchen)</h1>
        <p className="text-sm text-gray-500 mt-1">Manage orders being prepared or ready for pickup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {orders.map(order => (
          <div key={order.id} className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col ${
            order.status === 'Ready for Pickup' ? 'border-purple-200 bg-purple-50/10' : 'border-gray-200'
          }`}>
            <div className="flex items-start justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ChefHat className={`h-5 w-5 ${order.status === 'Ready for Pickup' ? 'text-purple-600' : 'text-blue-600'}`} />
                  <h3 className="font-semibold text-base text-gray-900">{generateTrxCode(order.id, order.createdAt, order.customer)}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">Customer: <span className="font-semibold text-gray-900">{order.customer}</span></p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                order.status === 'Preparing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {order.status}
              </span>
            </div>
            
            <div className="flex-1">
              <div className="mb-4">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order Items</span>
                {order.items && order.items.length > 0 ? (
                  <ul className="space-y-2">
                    {order.items.map((item: any) => (
                      <li key={item.id} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-bold text-gray-900 mr-2">{item.quantity}x</span>
                          <span className="text-gray-800 font-medium">{item.productName}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">No item details.</p>
                )}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-100">
              <OrderActions id={order.id} status={order.status} />
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <ChefHat className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No active orders</h3>
            <p className="text-sm text-gray-500 mt-1">Paid orders (Preparing) will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
