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

  // Group by customer using DB Engine with database pagination
  const [paginatedStats, allCustomerGroups, topBuyerGroup] = await Promise.all([
    prisma.transaction.groupBy({
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
      take,
      skip,
    }),
    prisma.transaction.groupBy({
      by: ['customer'],
      where: {
        status: { in: [...PAID_STATUSES] },
        customer: q ? { contains: q } : undefined,
      },
    }),
    prisma.transaction.groupBy({
      by: ['customer'],
      _sum: { amount: true },
      where: {
        status: { in: [...PAID_STATUSES] },
        customer: { not: 'Guest' },
      },
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: 1,
    }),
  ]);

  const totalItems = allCustomerGroups.length;
  const totalPages = Math.ceil(totalItems / take) || 1;

  const customers = paginatedStats.map((s) => ({
    name: s.customer || 'Guest',
    totalSpent: s._sum.amount || 0,
    orderCount: s._count._all,
    lastOrder: s._max.createdAt || new Date(),
  }));

  const topBuyer = topBuyerGroup.length > 0 && topBuyerGroup[0].customer?.toLowerCase() !== 'guest'
    ? topBuyerGroup[0].customer
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Customer Directory</h1>
          <p className="text-sm text-[#7A6251] mt-1">Overview of customer order histories and purchase totals.</p>
        </div>

        <form method="GET" action="/customers" className="relative w-full sm:w-64">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A69383] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]"
          />
          <Search className="h-4 w-4 text-[#A69383] absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF7F2] text-[#7A6251] font-semibold text-xs border-b border-[#EADBCC]">
              <tr>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">Total Orders</th>
                <th className="px-5 py-3.5">Total Spent</th>
                <th className="px-5 py-3.5">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBCC]/60">
              {customers.map((c, idx) => (
                <tr key={`${c.name}-${idx}`} className="hover:bg-[#FAF7F2] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#FAF7F2] text-[#4A2E1B] border border-[#EADBCC] flex items-center justify-center font-bold text-xs uppercase">
                        {c.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-[#382213]">{c.name}</p>
                        {topBuyer === c.name && (
                          <span className="text-[10px] font-semibold text-[#7A4E0B] bg-[#FDF0D0] px-2.5 py-0.5 rounded-full mt-0.5 inline-block border border-[#F2DB94]">
                            Top Buyer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[#6B5344]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <ShoppingBag className="h-4 w-4 text-[#A69383]" />
                      {c.orderCount} orders
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#4A2E1B]">{formatRupiah(c.totalSpent)}</td>
                  <td className="px-5 py-3.5 text-[#7A6251] text-xs">{formatWibDate(c.lastOrder)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#7A6251]">
                    <Users className="h-10 w-10 mx-auto text-[#C4B2A2] mb-3" />
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
