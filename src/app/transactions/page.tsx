import { PrismaClient, Prisma } from '@prisma/client';
import { Eye, Search, Filter, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import TransactionActions from '@/components/TransactionActions';
import { generateTrxCode } from '@/lib/utils';
import Link from 'next/link';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const resolvedParams = await searchParams;
  
  const page = typeof resolvedParams.page === 'string' ? Number(resolvedParams.page) : 1;
  const sort = typeof resolvedParams.sort === 'string' ? resolvedParams.sort : 'newest';
  const q = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';

  const take = 10;
  const skip = (page - 1) * take;

  const where: Prisma.TransactionWhereInput = q ? {
    OR: [
      { customer: { contains: q } },
      { cashierName: { contains: q } },
      { status: { contains: q } }
    ]
  } : {};

  const orderBy: Prisma.TransactionOrderByWithRelationInput = {
    createdAt: sort === 'oldest' ? 'asc' : 'desc'
  };

  const totalItems = await prisma.transaction.count({ where });
  const totalPages = Math.ceil(totalItems / take);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy,
    take,
    skip
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Transactions History</h1>
        <p className="text-sm text-gray-500 mt-1">View incoming transactions and approve payments.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <form method="GET" action="/transactions" className="p-4 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search by customer..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
              />
            </div>
            <div className="relative">
              <select 
                name="sort" 
                defaultValue={sort} 
                className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 font-medium"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Search</button>
          </div>
          
          <Link href="/transactions/new" className="inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap">
            New Transaction
          </Link>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length > 0 ? transactions.map((trx) => (
                <tr key={trx.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {trx.createdAt.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-900">
                    {trx.customer}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    Rp {trx.amount.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      trx.status === 'Waiting Payment' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      trx.status === 'Preparing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      trx.status === 'Ready for Pickup' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      trx.status === 'Picked Up' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      trx.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      {trx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {trx.status === 'Waiting Payment' && (
                        <TransactionActions id={trx.id} />
                      )}
                      <Link href={`/transactions/${trx.id}/print?type=text`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors">
                        <Printer className="h-3 w-3" /> Print
                      </Link>
                      <Link href={`/transactions/${trx.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors">
                        <Eye className="h-3 w-3" /> Detail
                      </Link>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
            <span className="text-sm text-gray-500">
              Showing {skip + 1} to {Math.min(skip + take, totalItems)} of {totalItems} items
            </span>
            <div className="flex items-center gap-1">
              <Link
                href={`?page=${Math.max(1, page - 1)}&sort=${sort}&q=${q}`}
                className={`p-2 rounded-md ${page === 1 ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              
              {[...Array(totalPages)].map((_, i) => (
                <Link
                  key={i + 1}
                  href={`?page=${i + 1}&sort=${sort}&q=${q}`}
                  className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium ${
                    page === i + 1 ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </Link>
              ))}

              <Link
                href={`?page=${Math.min(totalPages, page + 1)}&sort=${sort}&q=${q}`}
                className={`p-2 rounded-md ${page === totalPages ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
