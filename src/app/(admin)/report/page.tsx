import { prisma } from '@/lib/prisma';
import { 
  TrendingUp, 
  Clock, 
  Users, 
  Coffee, 
  Banknote, 
  CalendarDays,
  Download
} from 'lucide-react';
import { connection } from 'next/server';
import DateFilter from '@/components/DateFilter';
import { resolveRange, wibHour } from '@/lib/dates';
import { PAID_STATUSES } from '@/lib/constants';
import { formatRupiah } from '@/lib/utils';

export const instant = false;

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; preset?: string }>;
}) {
  await connection();
  const resolvedParams = await searchParams;

  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' },
  });

  const range = resolveRange(resolvedParams, activeShift?.startTime ?? null);
  const { start: startDate, end: endDate, preset, startStr, endStr, days: daysInRange } = range;

  // Run all report metrics queries concurrently with optimized database aggregation
  const [
    expenseSum,
    revenueSum,
    cogsItems,
    prepData,
    customerCount,
    timeData,
    itemStats,
    shiftsCount,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: {
        status: { in: [...PAID_STATUSES] },
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    prisma.transactionItem.findMany({
      where: {
        transaction: {
          status: { in: [...PAID_STATUSES] },
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      select: { quantity: true, costPrice: true },
    }),
    prisma.transaction.findMany({
      where: {
        status: { in: [...PAID_STATUSES] },
        readyAt: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true, preparedAt: true, readyAt: true },
    }),
    prisma.transaction.groupBy({
      by: ['customer'],
      where: {
        status: { in: [...PAID_STATUSES] },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.transaction.findMany({
      where: {
        status: { in: [...PAID_STATUSES] },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true },
    }),
    prisma.transactionItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true },
      where: {
        transaction: {
          status: { in: [...PAID_STATUSES] },
          createdAt: { gte: startDate, lte: endDate },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.shift.count({
      where: {
        startTime: { lte: endDate },
        OR: [{ endTime: { gte: startDate } }, { endTime: null }],
      },
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

  // 2. KITCHEN PERFORMANCE
  let totalPrepTimeMs = 0;
  let validPrepCount = 0;
  for (const t of prepData) {
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

  // Peak Hours using WIB hour
  const hourCounts: Record<number, number> = {};
  for (const t of timeData) {
    const hour = wibHour(t.createdAt);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  let peakHourStr = 'N/A';
  if (Object.keys(hourCounts).length > 0) {
    const peakHour = Object.keys(hourCounts).reduce((a, b) => (hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b));
    peakHourStr = `${peakHour}:00 - ${parseInt(peakHour) + 1}:00`;
  }

  const topProducts = itemStats.map((stat) => [stat.productName, stat._sum.quantity || 0] as const);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col gap-5 border-b border-gray-200 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Business Report</h1>
            <p className="text-sm text-gray-500 mt-1">Deep dive into your net profit, kitchen speed, and sales data.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200 shadow-sm whitespace-nowrap">
              {shiftsCount} Shift{shiftsCount !== 1 ? 's' : ''} Detected
            </span>
            <a
              href={`/api/export?start=${startStr}&end=${endStr}&preset=${preset}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 border border-transparent text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              Export Data (.xlsx)
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-100">
          <DateFilter defaultStart={startStr} defaultEnd={endStr} activePreset={preset} />
        </div>
      </div>

      {/* TOP FINANCIAL WIDGETS */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-50 rounded-md">
                <Banknote className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Gross Revenue</p>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{formatRupiah(todayGrossRevenue)}</h3>
            <p className="text-xs text-gray-400 mt-1">Total incoming sales</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 rounded-md">
                <TrendingUp className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Total COGS</p>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{formatRupiah(todayCogs)}</h3>
            <p className="text-xs text-gray-400 mt-1">Cost of goods sold</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-amber-50 rounded-md">
                <CalendarDays className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Operating Expenses</p>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{formatRupiah(todayApportionedOpex)}</h3>
            <p className="text-xs text-gray-400 mt-1">Total expenses for this period</p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="h-16 w-16 text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white/10 rounded-md">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-300">True Net Profit</p>
              </div>
              <h3 className="text-xl font-semibold text-white">{formatRupiah(todayNetProfit)}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {daysInRange ? `Across ${daysInRange} selected days` : 'All-time overview'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OPERATIONAL WIDGETS */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Operational Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 rounded-md">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Avg. Kitchen Prep Time</p>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900">
              {avgPrepTimeMinutes} <span className="text-sm font-normal text-gray-500">minutes</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">From &quot;Preparing&quot; to &quot;Ready&quot;</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 rounded-md">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Customer Base</p>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900">
              {uniqueCustomers} <span className="text-sm font-normal text-gray-500">customers</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">Unique customer names recorded</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-50 rounded-md">
                <Coffee className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Peak Busiest Hours</p>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">{peakHourStr}</h3>
            <p className="text-xs text-gray-400 mt-1">Time of day with most orders (WIB)</p>
          </div>
        </div>
      </div>

      {/* BEST SELLERS SECTION */}
      <div className="pt-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Analytics</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Top Best Selling Items
            </h2>
          </div>
          <div className="p-6">
            {topProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topProducts.map(([name, qty], index) => (
                  <div key={name} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold shadow-sm ${
                          index === 0
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : index === 1
                            ? 'bg-gray-200 text-gray-700 border border-gray-300'
                            : index === 2
                            ? 'bg-orange-100 text-orange-700 border border-orange-200'
                            : 'bg-white text-gray-400 border border-gray-200'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-600">
                      {qty} <span className="font-medium text-gray-500 uppercase">sold</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 py-8">No sales data found for the selected period.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
