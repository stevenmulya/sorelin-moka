import { prisma } from '@/lib/prisma';
import { Wallet, LogIn, LogOut, FileText } from 'lucide-react';
import CloseShiftForm from '@/components/CloseShiftForm';
import { openShift } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { connection } from 'next/server';
import { getActiveShift, summarizeShift, expectedCashOf } from '@/lib/services/shifts';
import { formatWibDate, formatWibTime } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function ShiftPage() {
  await connection();

  const [activeShift, recentShifts] = await Promise.all([
    getActiveShift(),
    prisma.shift.findMany({
      where: { status: 'Closed' },
      orderBy: { endTime: 'desc' },
      take: 5,
    }),
  ]);

  const summary = activeShift ? await summarizeShift(prisma, activeShift.id) : null;
  const expectedCash = activeShift && summary ? expectedCashOf(activeShift.initialCash, summary) : 0;
  const pendingCount = summary?.pendingCount ?? 0;
  const activeKitchenCount = summary?.activeKitchenCount ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Shift Management</h1>
        <p className="text-sm text-[#8E6D53] mt-1">Open a shift to start selling. Close it to reconcile your cash drawer.</p>
      </div>

      {!activeShift || !summary ? (
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-8 shadow-xs text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FAF0DA] border border-[#E5D5BC] mb-6">
            <Wallet className="h-8 w-8 text-[#6B4227]" />
          </div>
          <h2 className="text-2xl font-bold text-[#6B4227] mb-2">No Active Shift</h2>
          <p className="text-[#8E6D53] mb-8 max-w-md mx-auto">
            You cannot process new transactions until a shift is opened. Enter your name and the initial cash amount in the drawer to begin.
          </p>

          <ActionForm action={openShift} className="max-w-sm mx-auto bg-[#FAF0DA] p-6 rounded-2xl border border-[#E5D5BC] text-left space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#6B4227] mb-1">Cashier Name</label>
              <input
                type="text"
                name="openedBy"
                required
                maxLength={60}
                placeholder="Your Name"
                className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#6B4227] mb-1">Initial Cash (Rp)</label>
              <input
                type="number"
                name="initialCash"
                required
                defaultValue={0}
                min={0}
                className="w-full px-3 py-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-sm text-[#3F2311] focus:ring-2 focus:ring-[#6B4227]/20 focus:border-[#6B4227] focus:outline-none"
              />
            </div>
            <SubmitButton
              pendingText="Starting..."
              className="w-full py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold hover:bg-[#54311B] transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <LogIn className="h-4 w-4" /> Start Shift
            </SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-[#E5D5BC] bg-[#FAF0DA]/60">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
                  Active Shift
                </span>
                <span className="text-sm text-[#8E6D53]">{formatWibTime(activeShift.startTime)} WIB</span>
              </div>
              <h2 className="text-2xl font-bold text-[#6B4227]">Active Shift Running</h2>
              <p className="text-[#8E6D53] mt-1">
                Opened by <span className="font-semibold text-[#6B4227]">{activeShift.openedBy}</span>
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[#FAF0DA] rounded-xl border border-[#E5D5BC]">
                  <p className="text-xs font-bold text-[#8E6D53] mb-1">Total Sales</p>
                  <p className="text-xl font-bold text-[#6B4227] truncate">{formatRupiah(summary.revenue)}</p>
                </div>
                <div className="p-4 bg-[#FAF0DA] rounded-xl border border-[#E5D5BC]">
                  <p className="text-xs font-bold text-[#8E6D53] mb-1">QRIS / Debit</p>
                  <p className="text-xl font-bold text-[#C88A32] truncate">{formatRupiah(summary.qrisSales + summary.debitSales)}</p>
                </div>
              </div>

              <div className="border-t border-[#E5D5BC]/60 pt-6">
                <h3 className="text-sm font-bold text-[#6B4227] mb-4">Cash Drawer Calculation</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-[#5C3A21]">
                    <span>Starting Cash Float</span>
                    <span>{formatRupiah(activeShift.initialCash)}</span>
                  </div>
                  <div className="flex justify-between text-[#5C3A21]">
                    <span>+ Cash Sales</span>
                    <span>{formatRupiah(summary.cashSales)}</span>
                  </div>
                  {summary.cashExpenses > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>- Cash Drawer Expenses</span>
                      <span>- {formatRupiah(summary.cashExpenses)}</span>
                    </div>
                  )}
                  {summary.nonCashExpenses > 0 && (
                    <div className="flex justify-between text-[#8E6D53] text-xs py-1 px-2 bg-[#FAF0DA] rounded-lg border border-[#E5D5BC]">
                      <span>Bank / Owner Expenses (External)</span>
                      <span>{formatRupiah(summary.nonCashExpenses)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[#6B4227] pt-2 border-t border-dashed border-[#E5D5BC]">
                    <span>Expected Cash in Drawer</span>
                    <span>{formatRupiah(expectedCash)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs flex flex-col">
            <div className="p-6 border-b border-[#E5D5BC] bg-[#FAF0DA]/60">
              <h2 className="text-lg font-bold text-[#6B4227] flex items-center gap-2">
                <LogOut className="h-5 w-5 text-[#8E6D53]" /> Close Shift
              </h2>
              <p className="text-sm text-[#8E6D53] mt-1">Count the physical cash in your drawer before closing.</p>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-center">
              <CloseShiftForm
                shiftId={activeShift.id}
                expectedCash={expectedCash}
                pendingCount={pendingCount}
                activeKitchenCount={activeKitchenCount}
                openedBy={activeShift.openedBy}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent Shifts History */}
      {recentShifts.length > 0 && (
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl shadow-xs overflow-hidden mt-8">
          <div className="px-5 py-4 border-b border-[#E5D5BC] bg-[#FAF0DA]/60">
            <h3 className="text-sm font-bold text-[#6B4227] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#8E6D53]" /> Recent Closed Shifts
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#FAF0DA] text-[#8E6D53] font-semibold text-xs border-b border-[#E5D5BC]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Cashier</th>
                  <th className="px-5 py-3.5 text-right">Expected</th>
                  <th className="px-5 py-3.5 text-right">Actual</th>
                  <th className="px-5 py-3.5 text-right">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5D5BC]/60">
                {recentShifts.map((s) => {
                  const diff = (s.actualCash ?? 0) - (s.expectedCash ?? 0);
                  return (
                    <tr key={s.id} className="hover:bg-[#FAF0DA]/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#3F2311]">{formatWibDate(s.startTime)}</div>
                        <div className="text-xs text-[#8E6D53]">
                          {formatWibTime(s.startTime)} - {s.endTime ? formatWibTime(s.endTime) : '-'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#5C3A21]">
                        {s.openedBy} &rarr; {s.closedBy ?? '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[#8E6D53]">{formatRupiah(s.expectedCash ?? 0)}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#6B4227]">
                        {formatRupiah(s.actualCash ?? 0)}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-bold ${
                          diff === 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-[#C88A32]'
                        }`}
                      >
                        {diff > 0 ? `+${formatRupiah(diff)}` : diff < 0 ? `-${formatRupiah(Math.abs(diff))}` : formatRupiah(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
