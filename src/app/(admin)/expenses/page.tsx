import { connection } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Banknote, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { createExpense, deleteExpense } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { getActiveShift } from '@/lib/services/shifts';
import { formatWibDate } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const PAGE_SIZE = 50;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const view = typeof resolvedParams.view === 'string' ? resolvedParams.view : 'shift';
  const rawPage = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const where: Prisma.ExpenseWhereInput = {};
  if (view === 'shift') {
    const activeShift = await getActiveShift();
    where.shiftId = activeShift ? activeShift.id : -1;
  }

  const [totalCount, activeExpenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(view === 'all' ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
    }),
  ]);

  const totalPages = view === 'all' ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Operational Expenses</h1>
        <p className="text-sm text-[#8E6D53] mt-1">Record daily operational expenses (Cash Basis).</p>
      </div>

      <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#E5D5BC] bg-[#FAF0DA]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-[#6B4227] flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[#C88A32]" />
            Add New Expense
          </h2>
          <form method="GET" action="/expenses" className="flex bg-[#FFFDF8] rounded-xl border border-[#E5D5BC] p-1">
            <button
              type="submit"
              name="view"
              value="shift"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                view === 'shift' ? 'bg-[#6B4227] text-[#FAF0DA] shadow-xs' : 'text-[#8E6D53] hover:text-[#6B4227]'
              }`}
            >
              This Shift
            </button>
            <button
              type="submit"
              name="view"
              value="all"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                view === 'all' ? 'bg-[#6B4227] text-[#FAF0DA] shadow-xs' : 'text-[#8E6D53] hover:text-[#6B4227]'
              }`}
            >
              View All
            </button>
          </form>
        </div>

        <ActionForm action={createExpense} className="p-5 border-b border-[#E5D5BC] flex flex-col md:flex-row gap-4 items-end bg-[#FFFDF8]">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Expense Name</label>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Ice, Gas, Milk, Rent, Internet"
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227]"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Paid From</label>
            <select
              name="paymentMethod"
              defaultValue="Cash"
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm font-semibold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227]"
            >
              <option value="Cash">Cash Drawer</option>
              <option value="Transfer">Bank Transfer</option>
              <option value="Owner">Owner Funds</option>
            </select>
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-[#8E6D53] mb-1.5">Total Cost (Rp)</label>
            <input
              type="number"
              name="amount"
              required
              min={1}
              placeholder="50000"
              className="w-full px-3.5 py-2.5 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] placeholder-[#9E826B] focus:outline-none focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227]"
            />
          </div>
          <SubmitButton
            pendingText="Adding..."
            className="w-full md:w-auto px-6 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF0DA] text-[#8E6D53] font-semibold text-xs border-b border-[#E5D5BC]">
              <tr>
                <th className="px-5 py-3.5">Expense Name</th>
                <th className="px-5 py-3.5">Paid From</th>
                <th className="px-5 py-3.5">Date Recorded</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5D5BC]/60">
              {activeExpenses.length > 0 ? (
                activeExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF0DA]/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#3F2311]">{exp.name}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          exp.paymentMethod === 'Cash'
                            ? 'bg-[#FEF6E7] text-[#9E7324] border border-[#F3DBAA]'
                            : exp.paymentMethod === 'Transfer'
                              ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                              : 'bg-[#FAF5FF] text-[#7E22CE] border border-[#E9D5FF]'
                        }`}
                      >
                        {exp.paymentMethod === 'Cash'
                          ? 'Cash Drawer'
                          : exp.paymentMethod === 'Transfer'
                            ? 'Bank Transfer'
                            : 'Owner Funds'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#8E6D53]">{formatWibDate(exp.createdAt)}</td>
                    <td className="px-5 py-3.5 font-bold text-red-600">- {formatRupiah(exp.amount)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <ActionForm action={deleteExpense} confirmMessage="Delete this expense?">
                        <input type="hidden" name="id" value={exp.id} />
                        <SubmitButton
                          pendingText="..."
                          className="text-[#9E826B] hover:text-red-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#8E6D53]">
                    {view === 'shift' && where.shiftId === -1
                      ? "No active shift is currently running. Start a shift first, or switch to 'View All' to view history."
                      : 'No operational expenses recorded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {view === 'all' && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[#E5D5BC] bg-[#FAF0DA]/60 flex items-center justify-between text-xs text-[#8E6D53]">
            <span>
              Page <strong className="text-[#6B4227]">{page}</strong> of <strong className="text-[#6B4227]">{totalPages}</strong> ({totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/expenses?view=all&page=${page - 1}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg font-semibold text-[#6B4227] hover:bg-[#FAF0DA] transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/expenses?view=all&page=${page + 1}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-lg font-semibold text-[#6B4227] hover:bg-[#FAF0DA] transition-colors"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
