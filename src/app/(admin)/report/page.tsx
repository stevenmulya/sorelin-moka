import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  TrendingUp,
  Clock,
  Users,
  Coffee,
  Banknote,
  CalendarDays,
  Download,
} from 'lucide-react';
import { connection } from 'next/server';
import DateFilter from '@/components/DateFilter';
import { resolveRange, wibHour } from '@/lib/dates';
import { getActiveShift } from '@/lib/services/shifts';
import { PAID_STATUSES } from '@/lib/constants';
import { formatRupiah } from '@/lib/utils';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; preset?: string }>;
}) {
  await connection();
  const resolvedParams = await searchParams;

  const activeShift = await getActiveShift();

  const range = resolveRange(resolvedParams, activeShift?.startTime ?? null);
  const { start: startDate, end: endDate, preset, startStr, endStr, days: daysInRange } = range;

  const isThisShift = preset === 'this_shift';
  const shiftFilterId = activeShift ? activeShift.id : -1;

  const trxWhere: Prisma.TransactionWhereInput = isThisShift
    ? { status: { in: [...PAID_STATUSES] }, shiftId: shiftFilterId }
    : { status: { in: [...PAID_STATUSES] }, createdAt: { gte: startDate, lte: endDate } };

  const expenseWhere: Prisma.ExpenseWhereInput = isThisShift
    ? { shiftId: shiftFilterId }
    : { createdAt: { gte: startDate, lte: endDate } };

  const shiftCountWhere: Prisma.ShiftWhereInput = isThisShift
    ? { id: shiftFilterId }
    : {
        startTime: { lte: endDate },
        OR: [{ endTime: { gte: startDate } }, { endTime: null }],
      };

  // Run all report metrics queries concurrently with optimized database aggregation
  const [
    expenseSum,
    revenueSum,
    cogsItems,
    paidTransactions,
    customerCount,
    itemStats,
    shiftsCount,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: trxWhere,
      _sum: { amount: true },
    }),
    prisma.transactionItem.findMany({
      where: {
        transaction: trxWhere,
      },
      select: { quantity: true, costPrice: true },
    }),
    prisma.transaction.findMany({
      where: trxWhere,
      select: { createdAt: true, preparedAt: true, readyAt: true },
    }),
    prisma.transaction.groupBy({
      by: ['customer'],
      where: trxWhere,
    }),
    prisma.transactionItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true },
      where: {
        transaction: trxWhere,
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.shift.count({
      where: shiftCountWhere,
    }),
  ]);

  // 1. FINANCE CALCULATIONS (Aggregated directly)
  const todayGrossRevenue = revenueSum._sum.amount || 0;
  const todayApportionedOpex = expenseSum._sum.amount || 0;
  let todayCogs = 0;
  for (const item of cogsItems) {
    todayCogs += item.quantity * item.costPrice;
  }

  const todayNetProfit = todayGrossRevenue - todayCogs - todayApportionedOpex;

  // 2. KITCHEN PERFORMANCE & PEAK HOURS (Single pass over paidTransactions)
  let totalPrepTimeMs = 0;
  let validPrepCount = 0;
  const hourCounts: Record<number, number> = {};

  for (const t of paidTransactions) {
    const hour = wibHour(t.createdAt);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

    if (t.readyAt) {
      const startMs = t.preparedAt ? t.preparedAt.getTime() : t.createdAt.getTime();
      const diff = t.readyAt.getTime() - startMs;
      if (diff > 0) {
        totalPrepTimeMs += diff;
        validPrepCount++;
      }
    }
  }
  const avgPrepTimeMinutes = validPrepCount > 0 ? Math.round(totalPrepTimeMs / validPrepCount / 60000) : 0;

  // 3. SALES ANALYTICS
  const uniqueCustomers = customerCount.length;

  let peakHourStr = 'N/A';
  if (Object.keys(hourCounts).length > 0) {
    const peakHour = Object.keys(hourCounts).reduce((a, b) => (hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b));
    peakHourStr = `${peakHour}:00 - ${parseInt(peakHour) + 1}:00`;
  }

  const topProducts = itemStats.map((stat) => [stat.productName, stat._sum.quantity || 0] as const);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-[#E5D5BC] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Business Report</h1>
            <p className="text-sm text-[#8E6D53] mt-1">Comprehensive insights into net profit, kitchen speed, and sales performance.</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <span className="px-3 py-1.5 bg-[#F3DBAA] text-[#54311B] text-xs font-semibold rounded-xl border border-[#DFC082] shadow-xs whitespace-nowrap">
              {shiftsCount} Shift{shiftsCount !== 1 ? 's' : ''} Detected
            </span>
            <a
              href={`/api/export?start=${startStr}&end=${endStr}&preset=${preset}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#54311B] transition-colors shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export Excel (.xlsx)
            </a>
          </div>
        </div>

        {/* Filter Card */}
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-3 sm:p-3.5 shadow-xs">
          <DateFilter defaultStart={startStr} defaultEnd={endStr} activePreset={preset} />
        </div>
      </div>

      {/* TOP FINANCIAL WIDGETS */}
      <div>
        <h2 className="text-base font-bold text-[#6B4227] mb-3.5">Financial Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs hover:border-[#D5C1A1] transition-all">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#F0FDF4] rounded-xl">
                <Banknote className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Gross Revenue</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227] truncate">{formatRupiah(todayGrossRevenue)}</h3>
            <p className="text-xs text-[#8E6D53] mt-1">Total incoming sales</p>
          </div>

          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs hover:border-[#D5C1A1] transition-all">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#FEF2F2] rounded-xl">
                <TrendingUp className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Total COGS</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227] truncate">{formatRupiah(todayCogs)}</h3>
            <p className="text-xs text-[#8E6D53] mt-1">Cost of goods sold</p>
          </div>

          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs hover:border-[#D5C1A1] transition-all">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#FEF6E7] rounded-xl">
                <CalendarDays className="h-4 w-4 text-[#9A6208]" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Operating Expenses</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227] truncate">{formatRupiah(todayApportionedOpex)}</h3>
            <p className="text-xs text-[#8E6D53] mt-1">Expenses recorded in this period</p>
          </div>

          <div className="bg-[#6B4227] rounded-2xl border border-[#54311B] p-5 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="h-16 w-16 text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="p-2 bg-white/10 rounded-xl">
                  <TrendingUp className="h-4 w-4 text-[#F3DBAA]" />
                </div>
                <p className="text-xs font-bold text-[#F3DBAA]">Net Profit</p>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAF0DA] truncate">{formatRupiah(todayNetProfit)}</h3>
              <p className="text-xs text-[#E5D5BC] mt-1">
                {isThisShift
                  ? activeShift
                    ? `Current shift (#${activeShift.id})`
                    : 'No active shift'
                  : daysInRange
                    ? `Across ${daysInRange} selected days`
                    : 'All-time overview'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OPERATIONAL WIDGETS */}
      <div className="pt-2">
        <h2 className="text-base font-bold text-[#6B4227] mb-3.5">Operational Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#EFF6FF] rounded-xl">
                <Clock className="h-4 w-4 text-[#1D4ED8]" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Avg. Kitchen Prep Time</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227]">
              {avgPrepTimeMinutes} <span className="text-sm font-normal text-[#8E6D53]">minutes</span>
            </h3>
            <p className="text-xs text-[#8E6D53] mt-1">From &quot;Preparing&quot; to &quot;Ready&quot;</p>
          </div>

          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#FAF5FF] rounded-xl">
                <Users className="h-4 w-4 text-[#6B21A8]" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Customer Base</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227]">
              {uniqueCustomers} <span className="text-sm font-normal text-[#8E6D53]">customers</span>
            </h3>
            <p className="text-xs text-[#8E6D53] mt-1">Unique customer names recorded</p>
          </div>

          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] p-5 shadow-xs sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="p-2 bg-[#F3DBAA]/60 rounded-xl">
                <Coffee className="h-4 w-4 text-[#6B4227]" />
              </div>
              <p className="text-xs font-bold text-[#8E6D53]">Peak Busiest Hours</p>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#6B4227]">{peakHourStr}</h3>
            <p className="text-xs text-[#8E6D53] mt-1">Time of day with most orders (WIB)</p>
          </div>
        </div>
      </div>

      {/* BEST SELLERS SECTION */}
      <div className="pt-2">
        <h2 className="text-base font-bold text-[#6B4227] mb-3.5">Product Analytics</h2>
        <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-[#E5D5BC] bg-[#FAF0DA]/60">
            <h2 className="text-sm font-bold text-[#6B4227] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-700" />
              Top Selling Items
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            {topProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {topProducts.map(([name, qty], index) => (
                  <div key={name} className="flex items-center justify-between p-3.5 sm:p-4 bg-[#FAF0DA] rounded-xl border border-[#E5D5BC] gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-xs ${
                          index === 0
                            ? 'bg-[#F3DBAA] text-[#54311B] border border-[#DFC082]'
                            : index === 1
                              ? 'bg-[#E5D5BC] text-[#6B4227] border border-[#D5C1A1]'
                              : index === 2
                                ? 'bg-[#F2E6CF] text-[#6B4227] border border-[#E5D5BC]'
                                : 'bg-[#FFFDF8] text-[#8E6D53] border border-[#E5D5BC]'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-[#3F2311] truncate">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-800 whitespace-nowrap flex-shrink-0">
                      {qty} <span className="font-semibold text-[#8E6D53] text-xs">sold</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-[#8E6D53] py-8">No sales data found for the selected period.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
