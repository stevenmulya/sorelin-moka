import { connection } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Banknote, Plus, Trash2 } from 'lucide-react';
import { createExpense, deleteExpense } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { formatWibDate } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';

export const instant = false;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const resolvedParams = await searchParams;
  const view = typeof resolvedParams.view === 'string' ? resolvedParams.view : 'shift';

  const where: Prisma.ExpenseWhereInput = {};
  if (view === 'shift') {
    const activeShift = await prisma.shift.findFirst({ where: { status: 'Open' }, orderBy: { startTime: 'desc' } });
    if (activeShift) {
      where.shiftId = activeShift.id;
    } else {
      where.shiftId = -1;
    }
  }

  const activeExpenses = await prisma.expense.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Operational Expenses</h1>
        <p className="text-sm text-[#7A6251] mt-1">Record daily operational expenses (Cash Basis).</p>
      </div>

      <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#EADBCC] bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-[#4A2E1B] flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[#C69234]" />
            Add New Expense
          </h2>
          <form method="GET" action="/expenses" className="flex bg-[#FFFDF9] rounded-xl border border-[#EADBCC] p-1">
            <button
              type="submit"
              name="view"
              value="shift"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'shift' ? 'bg-[#4A2E1B] text-[#FFFDF9] shadow-xs' : 'text-[#7A6251] hover:text-[#4A2E1B]'
              }`}
            >
              This Shift
            </button>
            <button
              type="submit"
              name="view"
              value="all"
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                view === 'all' ? 'bg-[#4A2E1B] text-[#FFFDF9] shadow-xs' : 'text-[#7A6251] hover:text-[#4A2E1B]'
              }`}
            >
              See All
            </button>
          </form>
        </div>

        <ActionForm action={createExpense} className="p-5 border-b border-[#EADBCC] flex flex-col md:flex-row gap-4 items-end bg-[#FFFDF9]">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Expense Name</label>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Ice, Gas, Milk, Rent, Internet"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B]"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Paid From</label>
            <select
              name="paymentMethod"
              defaultValue="Cash"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm font-semibold text-[#382213] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B]"
            >
              <option value="Cash">Cash Drawer</option>
              <option value="Transfer">Bank Transfer</option>
              <option value="Owner">Owner Funds</option>
            </select>
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-semibold text-[#7A6251] mb-1.5">Total Cost (Rp)</label>
            <input
              type="number"
              name="amount"
              required
              min={1}
              placeholder="50000"
              className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] rounded-xl text-sm text-[#382213] placeholder-[#A89687] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]/20 focus:border-[#4A2E1B]"
            />
          </div>
          <SubmitButton
            pendingText="Adding..."
            className="w-full md:w-auto px-6 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF7F2] text-[#7A6251] font-semibold border-b border-[#EADBCC] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Expense Name</th>
                <th className="px-5 py-3.5">Paid From</th>
                <th className="px-5 py-3.5">Date Recorded</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBCC]/60">
              {activeExpenses.length > 0 ? (
                activeExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#FAF7F2]/60 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-[#382213]">{exp.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        exp.paymentMethod === 'Cash' 
                          ? 'bg-[#FEF6E7] text-[#9E7324] border border-[#F3E3BA]' 
                          : exp.paymentMethod === 'Transfer'
                          ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]'
                          : 'bg-[#FAF5FF] text-[#7E22CE] border border-[#E9D5FF]'
                      }`}>
                        {exp.paymentMethod === 'Cash' 
                          ? 'Cash Drawer' 
                          : exp.paymentMethod === 'Transfer' 
                          ? 'Bank Transfer' 
                          : 'Owner Funds'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#7A6251]">{formatWibDate(exp.createdAt)}</td>
                    <td className="px-5 py-3.5 font-bold text-red-600">- {formatRupiah(exp.amount)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <ActionForm action={deleteExpense} confirmMessage="Delete this expense?">
                        <input type="hidden" name="id" value={exp.id} />
                        <SubmitButton
                          pendingText="..."
                          className="text-[#A89687] hover:text-red-600 p-1.5 rounded-lg transition-colors cursor-pointer"
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
                  <td colSpan={5} className="px-5 py-12 text-center text-[#7A6251]">
                    {view === 'shift' && where.shiftId === -1
                      ? "No active shift currently running. Start a shift first, or switch to 'See All' to view history."
                      : 'No operational expenses recorded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
