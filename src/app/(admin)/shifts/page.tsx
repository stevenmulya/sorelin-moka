import { PrismaClient } from '@prisma/client';
import { Wallet, CheckCircle, Clock, Download } from 'lucide-react';
import { connection } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function ShiftsHistoryPage() {
  await connection();
  const allShifts = await prisma.shift.findMany({
    orderBy: { startTime: 'desc' }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Shifts History</h1>
        <p className="text-sm text-gray-500 mt-1">Review past cashier shifts, expected vs actual cash, and discrepancies.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Opened By</th>
                <th className="px-6 py-4 text-right">Actual Cash</th>
                <th className="px-6 py-4 text-right">Discrepancy</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allShifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No shifts found.
                  </td>
                </tr>
              ) : (
                allShifts.map(s => {
                  const isClosed = s.status === 'Closed';
                  const expected = s.expectedCash || 0;
                  const actual = s.actualCash || 0;
                  const diff = actual - expected;

                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        {isClosed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            <CheckCircle className="h-3.5 w-3.5" /> Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            <Clock className="h-3.5 w-3.5" /> Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{s.startTime.toLocaleDateString('id-ID')}</div>
                        <div className="text-xs text-gray-500">
                          {s.startTime.toLocaleTimeString('id-ID')} - {s.endTime ? s.endTime.toLocaleTimeString('id-ID') : 'Now'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{s.openedBy}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {isClosed ? `Rp ${actual.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isClosed ? '-' : (
                          <span className={`font-bold ${diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {diff > 0 ? '+' : ''} Rp {diff.toLocaleString('id-ID')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isClosed ? (
                          <a href={`/api/export-shift?shiftId=${s.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-800 transition-colors">
                            <Download className="h-3.5 w-3.5" /> Export Excel
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Close shift to export</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
