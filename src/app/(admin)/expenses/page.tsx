import { connection } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Banknote, Plus, Trash2 } from 'lucide-react';
import { createExpense, deleteExpense } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { formatWibDate } from '@/lib/dates';

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
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Operational Expenses</h1>
        <p className="text-sm text-gray-500 mt-1">Record daily operational expenses (Cash Basis).</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-600" />
            Add New Expense
          </h2>
          <form method="GET" action="/expenses" className="flex bg-white rounded-lg border border-gray-300 p-0.5">
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
          </form>
        </div>

        <ActionForm action={createExpense} className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end bg-white">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-gray-700 mb-1">Expense Name</label>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Ice, Gas, Milk, Rent, Internet"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-medium text-gray-700 mb-1">Paid From</label>
            <select
              name="paymentMethod"
              defaultValue="Cash"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-medium"
            >
              <option value="Cash">Cash Drawer</option>
              <option value="Transfer">Bank Transfer</option>
              <option value="Owner">Owner Funds</option>
            </select>
          </div>
          <div className="w-full md:w-44">
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Cost (Rp)</label>
            <input
              type="number"
              name="amount"
              required
              min={1}
              placeholder="50000"
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <SubmitButton
            pendingText="Adding..."
            className="w-full md:w-auto px-6 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add Expense
          </SubmitButton>
        </ActionForm>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Expense Name</th>
                <th className="px-5 py-3">Paid From</th>
                <th className="px-5 py-3">Date Recorded</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activeExpenses.length > 0 ? (
                activeExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{exp.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        exp.paymentMethod === 'Cash' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : exp.paymentMethod === 'Transfer'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}>
                        {exp.paymentMethod === 'Cash' 
                          ? 'Cash Drawer' 
                          : exp.paymentMethod === 'Transfer' 
                          ? 'Bank Transfer' 
                          : 'Owner Funds'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatWibDate(exp.createdAt)}</td>
                    <td className="px-5 py-3 font-medium text-red-600">- Rp {exp.amount.toLocaleString('id-ID')}</td>
                    <td className="px-5 py-3 text-right">
                      <ActionForm action={deleteExpense} confirmMessage="Delete this expense?">
                        <input type="hidden" name="id" value={exp.id} />
                        <SubmitButton
                          pendingText="..."
                          className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
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
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
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
