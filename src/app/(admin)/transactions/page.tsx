import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Search, Filter } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import { parsePage } from '@/lib/validation';
import { endOfWibDay, parseWibDate, startOfWibDay } from '@/lib/dates';
import Link from 'next/link';

export const instant = false;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const page = parsePage(resolvedParams.page);
  const sort = typeof resolvedParams.sort === 'string' ? resolvedParams.sort : 'newest';
  const q = typeof resolvedParams.q === 'string' ? resolvedParams.q.trim() : '';
  const dateStr = typeof resolvedParams.date === 'string' ? resolvedParams.date.trim() : '';
  const view = typeof resolvedParams.view === 'string' ? resolvedParams.view : 'shift';

  const take = 10;
  const skip = (page - 1) * take;

  const where: Prisma.TransactionWhereInput = {};

  if (view === 'shift') {
    const activeShift = await prisma.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
    where.shiftId = activeShift ? activeShift.id : -1;
  }

  if (q) {
    where.OR = [
      { customer: { contains: q } },
      { cashierName: { contains: q } },
      { status: { contains: q } },
    ];
  }

  if (dateStr && view !== 'shift') {
    const parsed = parseWibDate(dateStr);
    if (parsed) {
      where.createdAt = {
        gte: startOfWibDay(parsed),
        lte: endOfWibDay(parsed),
      };
    }
  }

  const orderBy: Prisma.TransactionOrderByWithRelationInput = {
    createdAt: sort === 'oldest' ? 'asc' : 'desc',
  };

  const [totalItems, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy,
      take,
      skip,
    }),
  ]);

  const totalPages = Math.ceil(totalItems / take) || 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Order History</h1>
        <p className="text-sm text-[#7A6251] mt-1">Review all completed sales, payment statuses, and print receipts.</p>
      </div>

      <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl overflow-hidden shadow-xs">
        <form method="GET" action="/transactions" className="p-4 border-b border-[#EADBCC] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FAF7F2]">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 flex-wrap">
            <div className="flex bg-[#FFFDF9] rounded-xl border border-[#EADBCC] p-0.5">
              <button
                type="submit"
                name="view"
                value="shift"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  view === 'shift' ? 'bg-[#4A2E1B] text-[#FFFDF9]' : 'text-[#7A6251] hover:text-[#4A2E1B]'
                }`}
              >
                This Shift
              </button>
              <button
                type="submit"
                name="view"
                value="all"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  view === 'all' ? 'bg-[#4A2E1B] text-[#FFFDF9]' : 'text-[#7A6251] hover:text-[#4A2E1B]'
                }`}
              >
                See All
              </button>
            </div>

            <div className="relative w-full max-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A69383]" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search transactions..."
                className="w-full pl-9 pr-4 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A69383] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] transition-all"
              />
            </div>

            {view === 'all' && (
              <input
                type="date"
                name="date"
                defaultValue={dateStr}
                className="px-3 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm text-[#382213] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] transition-all cursor-pointer min-w-[140px]"
              />
            )}

            <div className="relative">
              <select
                name="sort"
                defaultValue={sort}
                className="appearance-none pl-9 pr-8 py-2 bg-[#FFFDF9] border border-[#EADBCC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#4A2E1B] text-[#382213] font-medium cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6251]" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl text-sm font-semibold hover:bg-[#3D2413] transition-colors shadow-xs"
            >
              Apply
            </button>
            {(q || dateStr || view === 'all') && (
              <Link
                href="/transactions"
                className="px-4 py-2 bg-[#FFFDF9] text-[#7A6251] border border-[#EADBCC] rounded-xl text-sm font-semibold hover:bg-[#FAF7F2] hover:text-[#4A2E1B] transition-colors"
              >
                Clear
              </Link>
            )}
          </div>

          <Link
            href="/transactions/new"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            New Order
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF7F2] text-[#7A6251] font-semibold text-xs uppercase tracking-wider border-b border-[#EADBCC]">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBCC]/60">
              {transactions.length > 0 ? (
                transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-[#FAF7F2] transition-colors">
                    <td className="px-5 py-3.5 font-bold text-xs text-[#4A2E1B]">
                      {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[#382213]">{trx.customer}</td>
                    <td className="px-5 py-3.5 font-bold text-[#4A2E1B]">
                      {formatRupiah(trx.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={trx.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TransactionActions id={trx.id} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#7A6251]">
                    {view === 'shift' && where.shiftId === -1
                      ? "No active shift currently running. Open a shift first, or select 'See All' to view history."
                      : 'No transactions found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          basePath="/transactions"
          params={{
            q: q || undefined,
            sort: sort !== 'newest' ? sort : undefined,
            date: dateStr || undefined,
            view: view !== 'shift' ? view : undefined,
          }}
          totalItems={totalItems}
          pageSize={take}
        />
      </div>
    </div>
  );
}
