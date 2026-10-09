import { PrismaClient } from '@prisma/client';
import { Users, Search, ShoppingBag } from 'lucide-react';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.toLowerCase() || '';

  // Group by customer using DB Engine
  const customerStats = await prisma.transaction.groupBy({
    by: ['customer'],
    _sum: { amount: true },
    _count: { _all: true },
    _max: { createdAt: true },
    where: {
      status: { not: 'Cancelled' },
      customer: q ? { contains: q } : undefined
    },
    orderBy: {
      _sum: { amount: 'desc' }
    }
  });

  const customers = customerStats.map(s => ({
    name: s.customer,
    totalSpent: s._sum.amount || 0,
    orderCount: s._count._all,
    lastOrder: s._max.createdAt || new Date()
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your loyal customers and their purchase history.</p>
        </div>
        
        <form className="relative w-full sm:w-64">
          <input 
            type="text" 
            name="q" 
            defaultValue={q} 
            placeholder="Search customers..." 
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-6 py-4">Customer Name</th>
              <th className="px-6 py-4">Total Orders</th>
              <th className="px-6 py-4">Total Spent</th>
              <th className="px-6 py-4">Last Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c, i) => (
              <tr key={c.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs uppercase">
                      {c.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      {i === 0 && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">TOP BUYER</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="h-4 w-4 text-gray-400" />
                    {c.orderCount} orders
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-emerald-600">
                  Rp {c.totalSpent.toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {c.lastOrder.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                  <p>No customers found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
