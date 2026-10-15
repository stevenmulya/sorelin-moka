import { prisma } from '@/lib/prisma';
import { CheckCircle, Clock, Download } from 'lucide-react';
import { connection } from 'next/server';
import { formatWibDate, formatWibTime } from '@/lib/dates';
import { formatRupiah } from '@/lib/utils';

export const instant = false;

export default async function ShiftsHistoryPage() {
  await connection();
  const allShifts = await prisma.shift.findMany({
    orderBy: { startTime: 'desc' },
    take: 100,
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#4A2E1B] tracking-tight">Shift History</h1>
        <p className="text-sm text-[#7A6251] mt-1">Review past cashier shifts, expected vs actual cash, and discrepancies.</p>
      </div>

      <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#FAF7F2] text-[#7A6251] font-semibold text-xs border-b border-[#EADBCC]">
              <tr>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Opened By</th>
                <th className="px-5 py-3.5 text-right">Actual Cash</th>
                <th className="px-5 py-3.5 text-right">Discrepancy</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBCC]/60">
              {allShifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[#7A6251]">
                    No shifts found.
                  </td>
                </tr>
              ) : (
                allShifts.map((s) => {
                  const isClosed = s.status === 'Closed';
                  const expected = s.expectedCash ?? 0;
                  const actual = s.actualCash ?? 0;
                  const diff = actual - expected;

                  return (
                    <tr key={s.id} className="hover:bg-[#FAF7F2] transition-colors">
                      <td className="px-5 py-3.5">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FAF7F2] text-[#7A6251] border border-[#EADBCC]">
                            <CheckCircle className="h-3.5 w-3.5" /> Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Clock className="h-3.5 w-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#382213]">{formatWibDate(s.startTime)}</div>
                        <div className="text-xs text-[#7A6251]">
                          {formatWibTime(s.startTime)} - {s.endTime ? formatWibTime(s.endTime) : 'Now'}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-[#382213]">{s.openedBy}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#4A2E1B]">
                        {isClosed ? formatRupiah(actual) : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {!isClosed ? (
                          '-'
                        ) : (
                          <span className={`font-bold ${diff === 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-[#C69234]'}`}>
                            {diff > 0 ? `+${formatRupiah(diff)}` : diff < 0 ? `-${formatRupiah(Math.abs(diff))}` : formatRupiah(0)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isClosed ? (
                          <a
                            href={`/api/export-shift?shiftId=${s.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl text-xs font-semibold hover:bg-[#3D2413] transition-colors shadow-xs"
                          >
                            <Download className="h-3.5 w-3.5" /> Export Excel (.xlsx)
                          </a>
                        ) : (
                          <span className="text-[#A69383] text-xs italic">Close shift to export</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
