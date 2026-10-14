import { prisma } from '@/lib/prisma';
import { Users, Search, ShoppingBag } from 'lucide-react';
import { PAID_STATUSES } from '@/lib/constants';
import { formatWibDate } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';
import { parsePage } from '@/lib/validation';
import Pagination from '@/components/Pagination';
import { connection } from 'next/server';
export const instant = false;

export default async function CustomersPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ q?: string; page?: string }> 
}) {
  await connection();
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const page = parsePage(resolvedParams.page);
  const take = 10;
  const skip = (page - 1) * take;

  // Group by customer using DB Engine
  const customerStats = await prisma.transaction.groupBy({
    by: ['customer'],
    _sum: { amount: true },
    _count: { _all: true },
    _max: { createdAt: true },
    where: {
      status: { in: [...PAID_STATUSES] },
      customer: q ? { contains: q } : undefined,
    },
    orderBy: {
      _sum: { amount: 'desc' },
    },
  });

  const totalItems = customerStats.length;
  const totalPages = Math.ceil(totalItems / take) || 1;

  const paginatedStats = customerStats.slice(skip, skip + take);

  const customers = paginatedStats.map((s) => ({
    name: s.customer || 'Guest',
    totalSpent: s._sum.amount || 0,
    orderCount: s._count._all,
    lastOrder: s._max.createdAt || new Date(),
  }));

  const topBuyer = customerStats.length > 0 && customerStats[0].customer?.toLowerCase() !== 'guest'
    ? customerStats[0].customer
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Customer Directory</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of customer order histories and purchase totals.</p>
        </div>

        <form method="GET" action="/customers" className="relative w-full sm:w-64">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
              {customers.map((c, idx) => (
                <tr key={`${c.name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-xs uppercase">
                        {c.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{c.name}</p>
                        {topBuyer === c.name && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-0.5 inline-block border border-amber-200">
                            TOP BUYER
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="h-4 w-4 text-gray-400" />
                      {c.orderCount} orders
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-emerald-600">{formatRupiah(c.totalSpent)}</td>
                  <td className="px-6 py-4 text-gray-500">{formatWibDate(c.lastOrder)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Users className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/customers"
          params={{ q: q || undefined }}
          totalItems={totalItems}
          pageSize={take}
        />
      </div>
    </div>
  );
}
