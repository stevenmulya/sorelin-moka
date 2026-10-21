import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Search, Filter } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import Pagination from '@/components/Pagination';
import StatusBadge from '@/components/StatusBadge';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import { parsePage } from '@/lib/validation';
import { endOfWibDay, parseWibDate, startOfWibDay } from '@/lib/dates';
import { getActiveShift } from '@/lib/services/shifts';
import Link from 'next/link';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
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
    const activeShift = await getActiveShift();
    where.shiftId = activeShift ? activeShift.id : -1;
  }

  if (q) {
    const numericMatch = /^(?:TRX-)?0*(\d+)/i.exec(q);
    const parsedId = numericMatch ? parseInt(numericMatch[1], 10) : null;

    where.OR = [
      { customer: { contains: q } },
      { cashierName: { contains: q } },
      { status: { contains: q } },
      ...(parsedId !== null && !isNaN(parsedId) ? [{ id: parsedId }] : []),
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
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Order History</h1>
        <p className="text-sm text-[#8E6D53] mt-1">Review all completed sales, payment statuses, and print receipts.</p>
      </div>

      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
        <form
          method="GET"
          action="/transactions"
          className="p-4 border-b border-[#E5D5BC] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FAF0DA]/60"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 flex-wrap">
            <div className="flex bg-[#FFFDF8] rounded-xl border border-[#E5D5BC] p-0.5">
              <button
                type="submit"
                name="view"
                value="shift"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  view === 'shift' ? 'bg-[#6B4227] text-[#FAF0DA]' : 'text-[#8E6D53] hover:text-[#6B4227]'
                }`}
              >
                This Shift
              </button>
              <button
                type="submit"
                name="view"
                value="all"
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  view === 'all' ? 'bg-[#6B4227] text-[#FAF0DA]' : 'text-[#8E6D53] hover:text-[#6B4227]'
                }`}
              >
                View All
              </button>
            </div>

            <div className="relative w-full sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9E826B]" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search transactions..."
                className="w-full pl-9 pr-4 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] transition-all"
              />
            </div>

            {view === 'all' && (
              <input
                type="date"
                name="date"
                defaultValue={dateStr}
                className="w-full sm:w-auto px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] transition-all cursor-pointer min-w-[140px]"
              />
            )}

            <div className="relative w-full sm:w-auto">
              <select
                name="sort"
                defaultValue={sort}
                className="w-full sm:w-auto appearance-none pl-9 pr-8 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] text-[#3F2311] font-medium cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E6D53]" />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-sm font-semibold hover:bg-[#54311B] transition-colors shadow-xs cursor-pointer"
            >
              Apply
            </button>
            {(q || dateStr || view === 'all') && (
              <Link
                href="/transactions"
                className="w-full sm:w-auto text-center px-4 py-2 bg-[#FFFDF8] text-[#8E6D53] border border-[#E5D5BC] rounded-xl text-sm font-semibold hover:bg-[#FAF0DA] hover:text-[#6B4227] transition-colors cursor-pointer"
              >
                Clear
              </Link>
            )}
          </div>

          <Link
            href="/transactions/new"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs whitespace-nowrap cursor-pointer"
          >
            New Order
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF0DA] text-[#8E6D53] font-semibold text-xs border-b border-[#E5D5BC]">
              <tr>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5D5BC]/60">
              {transactions.length > 0 ? (
                transactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-[#FAF0DA]/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-xs text-[#6B4227]">
                      {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[#3F2311]">
                      <div className="flex items-center gap-2.5">
                        {trx.selfieUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={trx.selfieUrl}
                            alt={trx.customer}
                            className="w-7 h-7 rounded-full object-cover border border-[#E5D5BC] flex-shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#FAF0DA] border border-[#E5D5BC] text-[#6B4227] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {(trx.customer || 'G').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{trx.customer}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#6B4227]">{formatRupiah(trx.amount)}</td>
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
                  <td colSpan={5} className="px-6 py-12 text-center text-[#8E6D53]">
                    {view === 'shift' && where.shiftId === -1
                      ? "No active shift is currently running. Open a shift first, or select 'View All' to view history."
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
