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
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Transactions History</h1>
        <p className="text-sm text-gray-500 mt-1">View incoming transactions and approve payments.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <form method="GET" action="/transactions" className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 flex-wrap">
            <div className="flex bg-white rounded-lg border border-gray-300 p-0.5">
              <button
                type="submit"
                name="view"
                value="shift"
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'shift' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                This Shift
              </button>
              <button
                type="submit"
                name="view"
                value="all"
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  view === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                See All
              </button>
            </div>

            <div className="relative w-full max-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
            </div>

            {view === 'all' && (
              <input
                type="date"
                name="date"
                defaultValue={dateStr}
                className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all cursor-pointer min-w-[140px]"
              />
            )}

            <div className="relative">
              <select
                name="sort"
                defaultValue={sort}
                className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 font-medium cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
            >
              Apply
            </button>
            {(q || dateStr || view === 'all') && (
              <Link
                href="/transactions"
                className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Clear
              </Link>
            )}
          </div>

          <Link
            href="/transactions/new"
            className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
          >
            New Transaction
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length > 0 ? (
                transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
                    </td>
                    <td className="px-6 py-4 text-gray-900">{trx.customer}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {formatRupiah(trx.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={trx.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TransactionActions id={trx.id} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
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
