import { PrismaClient } from '@prisma/client';
import { Wallet, LogIn, LogOut, FileText, AlertCircle } from 'lucide-react';
import CloseShiftForm from '@/components/CloseShiftForm';
import { openShift, closeShift } from '@/app/actions';
import { connection } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function ShiftPage() {
  await connection();

  // Find the currently active shift (if any)
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  // Fetch today's closed shifts to show history
  const recentShifts = await prisma.shift.findMany({
    where: { status: 'Closed' },
    orderBy: { endTime: 'desc' },
    take: 5
  });

  let cashSales = 0;
  let qrisSales = 0;
  let debitSales = 0;
  let totalSales = 0;

  let pendingCount = 0;

  let shiftExpenses = 0;
  if (activeShift) {
    const transactions = await prisma.transaction.findMany({
      where: { 
        shiftId: activeShift.id,
        status: { not: 'Cancelled' }
      }
    });

    for (const trx of transactions) {
      if (trx.status === 'Waiting Payment') {
        pendingCount++;
        continue;
      }
      
      totalSales += trx.amount;
      if (trx.paymentMethod === 'Cash') cashSales += trx.amount;
      else if (trx.paymentMethod === 'QRIS') qrisSales += trx.amount;
      else if (trx.paymentMethod === 'Debit') debitSales += trx.amount;
      // if null, we assume cash for legacy, but ideally they shouldn't be null anymore
      else cashSales += trx.amount; 
    }

    const expenses = await prisma.expense.findMany({
      where: { shiftId: activeShift.id }
    });
    for (const exp of expenses) {
      shiftExpenses += exp.amount;
    }
  }

  const expectedCash = activeShift ? activeShift.initialCash + cashSales - shiftExpenses : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Shift Management</h1>
        <p className="text-sm text-gray-500 mt-1">Open a shift to start selling. Close it to reconcile your cash drawer.</p>
      </div>

      {!activeShift ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-6">
            <Wallet className="h-8 w-8 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Shift</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">You cannot process new transactions until a shift is opened. Enter your name and the initial cash amount in the drawer to begin.</p>
          
          <form action={openShift} className="max-w-sm mx-auto bg-gray-50 p-6 rounded-xl border border-gray-100 text-left space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cashier Name</label>
              <input type="text" name="openedBy" required placeholder="Your Name" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial Cash (Rp)</label>
              <input type="number" name="initialCash" required defaultValue={0} min={0} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
              <LogIn className="h-4 w-4" /> Start Shift
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-emerald-50/50">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                  Active Shift
                </span>
                <span className="text-sm text-gray-500">{activeShift.startTime.toLocaleTimeString()}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Shift running</h2>
              <p className="text-gray-600 mt-1">Opened by <span className="font-semibold text-gray-900">{activeShift.openedBy}</span></p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">Total Sales</p>
                  <p className="text-lg font-bold text-gray-900">Rp {totalSales.toLocaleString('id-ID')}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">QRIS / Debit</p>
                  <p className="text-lg font-bold text-blue-600">Rp {(qrisSales + debitSales).toLocaleString('id-ID')}</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Drawer Calculation</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Initial Cash</span>
                    <span>Rp {activeShift.initialCash.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>+ Cash Sales</span>
                    <span>Rp {cashSales.toLocaleString('id-ID')}</span>
                  </div>
                  {shiftExpenses > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>- Expenses</span>
                      <span>Rp {shiftExpenses.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-dashed border-gray-200">
                    <span>Expected Cash in Drawer</span>
                    <span>Rp {expectedCash.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <LogOut className="h-5 w-5 text-gray-400" /> Close Shift
              </h2>
              <p className="text-sm text-gray-500 mt-1">Count the physical cash in your drawer before closing.</p>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-center">
              <CloseShiftForm shiftId={activeShift.id} expectedCash={expectedCash} pendingCount={pendingCount} openedBy={activeShift.openedBy} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Shifts History */}
      {recentShifts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" /> Recent Closed Shifts
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Cashier</th>
                  <th className="px-6 py-3 text-right">Expected</th>
                  <th className="px-6 py-3 text-right">Actual</th>
                  <th className="px-6 py-3 text-right">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentShifts.map(s => {
                  const diff = (s.actualCash || 0) - (s.expectedCash || 0);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{s.startTime.toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{s.startTime.toLocaleTimeString()} - {s.endTime?.toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{s.openedBy} &rarr; {s.closedBy}</td>
                      <td className="px-6 py-3 text-right text-gray-600">Rp {s.expectedCash?.toLocaleString('id-ID')}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">Rp {s.actualCash?.toLocaleString('id-ID')}</td>
                      <td className={`px-6 py-3 text-right font-bold ${diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {diff > 0 ? '+' : ''} Rp {diff.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
