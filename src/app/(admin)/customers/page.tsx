import { prisma } from '@/lib/prisma';
import { Users, Search, ShoppingBag } from 'lucide-react';
import { PAID_STATUSES } from '@/lib/constants';
import { formatWibDate } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';
import { parsePage } from '@/lib/validation';
import Pagination from '@/components/Pagination';
import { connection } from 'next/server';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const q = resolvedParams.q?.trim() || '';
  const rawPage = parsePage(resolvedParams.page);
  const take = 10;

  // Group by customer using DB Engine with database pagination
  const [allCustomerGroups, topBuyerGroup] = await Promise.all([
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
        customer: { notIn: ['Guest', 'guest', 'GUEST', ''] },
      },
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: 5,
    }),
  ]);

  const totalItems = allCustomerGroups.length;
  const totalPages = Math.ceil(totalItems / take) || 1;
  const page = Math.min(rawPage, totalPages);
  const skip = (page - 1) * take;

  const paginatedStats = await prisma.transaction.groupBy({
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
  });

  const customers = paginatedStats.map((s) => ({
    name: s.customer || 'Guest',
    totalSpent: s._sum.amount || 0,
    orderCount: s._count._all,
    lastOrder: s._max.createdAt || new Date(),
  }));

  const topBuyerEntry = topBuyerGroup.find((g) => g.customer && g.customer.trim().toLowerCase() !== 'guest');
  const topBuyer = topBuyerEntry?.customer ?? null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Customer Directory</h1>
          <p className="text-sm text-[#8E6D53] mt-1">Overview of customer order histories and purchase totals.</p>
        </div>

        <form method="GET" action="/customers" className="relative w-full sm:w-64">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227]"
          />
          <Search className="h-4 w-4 text-[#9E826B] absolute left-3 top-1/2 -translate-y-1/2" />
        </form>
      </div>

      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF0DA] text-[#8E6D53] font-semibold text-xs border-b border-[#E5D5BC]">
              <tr>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">Total Orders</th>
                <th className="px-5 py-3.5">Total Spent</th>
                <th className="px-5 py-3.5">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5D5BC]/60">
              {customers.map((c, idx) => (
                <tr key={`${c.name}-${idx}`} className="hover:bg-[#FAF0DA]/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC] flex items-center justify-center font-bold text-xs uppercase">
                        {c.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-[#3F2311]">{c.name}</p>
                        {topBuyer === c.name && (
                          <span className="text-[10px] font-semibold text-[#54311B] bg-[#F3DBAA] px-2.5 py-0.5 rounded-full mt-0.5 inline-block border border-[#DFC082]">
                            Top Buyer
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[#5C3A21]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <ShoppingBag className="h-4 w-4 text-[#9E826B]" />
                      {c.orderCount} orders
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-bold text-[#6B4227]">{formatRupiah(c.totalSpent)}</td>
                  <td className="px-5 py-3.5 text-[#8E6D53] text-xs">{formatWibDate(c.lastOrder)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#8E6D53]">
                    <Users className="h-10 w-10 mx-auto text-[#9E826B] mb-3" />
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
