import { PrismaClient } from '@prisma/client';
import { createExpense, deleteExpense } from '@/app/actions';
import { 
  TrendingUp, 
  Clock, 
  Users, 
  Coffee, 
  Banknote, 
  CalendarDays,
  Plus,
  Trash2
} from 'lucide-react';

import { connection } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function InsightsPage() {
  await connection();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // FETCH ONLY ACTIVE EXPENSES
  const activeExpenses = await prisma.expense.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // 1. FINANCE CALCULATIONS (P&L) - Only fetch today's items to avoid OOM
  const todaysTransactions = await prisma.transaction.findMany({
    where: { status: { not: 'Cancelled' }, createdAt: { gte: today } },
    include: { items: true }
  });

  let todayGrossRevenue = 0;
  let todayCogs = 0;

  for (const trx of todaysTransactions) {
    todayGrossRevenue += trx.amount;
    let trxCost = 0;
    for (const item of trx.items) {
      trxCost += item.quantity * item.costPrice;
    }
    todayCogs += trxCost;
  }

  // Calculate OPEX (Operational Expenses)
  let todayApportionedOpex = 0;
  for (const exp of activeExpenses) {
    const start = new Date(exp.startDate).getTime();
    const end = new Date(exp.endDate).getTime();
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    const dailyRate = exp.amount / days;

    const expStartMidnight = new Date(exp.startDate);
    expStartMidnight.setHours(0,0,0,0);
    const expEndMidnight = new Date(exp.endDate);
    expEndMidnight.setHours(23,59,59,999);

    if (today >= expStartMidnight && today <= expEndMidnight) {
      todayApportionedOpex += dailyRate;
    }
  }

  const todayNetProfit = todayGrossRevenue - todayCogs - todayApportionedOpex;

  // 2. KITCHEN PERFORMANCE
  // Fetch ONLY createdAt and readyAt (minimal data payload)
  const prepData = await prisma.transaction.findMany({
    where: { status: { not: 'Cancelled' }, readyAt: { not: null } },
    select: { createdAt: true, readyAt: true }
  });

  let totalPrepTimeMs = 0;
  for (const t of prepData) {
    if (t.readyAt) {
      totalPrepTimeMs += (t.readyAt.getTime() - t.createdAt.getTime());
    }
  }
  const avgPrepTimeMinutes = prepData.length > 0 ? Math.round(totalPrepTimeMs / prepData.length / 60000) : 0;

  // 3. SALES ANALYTICS
  // Unique Customers using DB Aggregation (extremely fast)
  const customerCount = await prisma.transaction.groupBy({
    by: ['customer'],
    where: { status: { not: 'Cancelled' } }
  });
  const uniqueCustomers = customerCount.length;

  // Peak Hours - Apply UTC+7 for Indonesia
  const timeData = await prisma.transaction.findMany({
    where: { status: { not: 'Cancelled' } },
    select: { createdAt: true }
  });
  
  const hourCounts: Record<number, number> = {};
  for (const t of timeData) {
    const date = new Date(t.createdAt);
    date.setHours(date.getHours() + 7); // Timezone Offset UTC+7
    const hour = date.getUTCHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  
  let peakHourStr = "N/A";
  if (Object.keys(hourCounts).length > 0) {
    const peakHour = Object.keys(hourCounts).reduce((a, b) => hourCounts[parseInt(a)] > hourCounts[parseInt(b)] ? a : b);
    peakHourStr = `${peakHour}:00 - ${parseInt(peakHour)+1}:00`;
  }

  // Best Sellers using DB Aggregation (no memory overhead)
  const itemStats = await prisma.transactionItem.groupBy({
    by: ['productName'],
    _sum: { quantity: true },
    where: { transaction: { status: { not: 'Cancelled' } } },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5
  });
  
  const topProducts = itemStats.map(stat => [stat.productName, stat._sum.quantity || 0]);


  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Insights & Finance</h1>
        <p className="text-sm text-gray-500 mt-1">Deep dive into your profit, kitchen speed, and customer data.</p>
      </div>

      {/* TOP WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium text-gray-500">True Net Profit (Today)</p>
          </div>
          <h3 className="text-lg font-bold text-gray-900">Rp {Math.round(todayNetProfit).toLocaleString('id-ID')}</h3>
          <p className="text-[10px] text-gray-400 mt-1">After COGS & Apportioned OPEX</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-gray-500">Avg. Prep Time</p>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{avgPrepTimeMinutes} minutes</h3>
          <p className="text-[10px] text-gray-400 mt-1">From order to Ready for Pickup</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-purple-600" />
            <p className="text-xs font-medium text-gray-500">Customer Base</p>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{uniqueCustomers} unique</h3>
          <p className="text-[10px] text-gray-400 mt-1">Total distinct customers</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="h-4 w-4 text-amber-600" />
            <p className="text-xs font-medium text-gray-500">Peak Hours</p>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{peakHourStr}</h3>
          <p className="text-[10px] text-gray-400 mt-1">Busiest time of the day</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* OPEX SECTION */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  Operational Expenses (OPEX)
                </h2>
                <p className="text-xs text-gray-500 mt-1">Add fixed costs to amortize them daily.</p>
              </div>
            </div>
            
            <form action={createExpense} className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-end bg-white">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-700 mb-1">Expense Name</label>
                <input type="text" name="name" required placeholder="e.g. Rent, Electricity" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-gray-700 mb-1">Total Amount (Rp)</label>
                <input type="number" name="amount" required placeholder="500000" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div className="w-full sm:w-32">
                <label className="block text-xs font-medium text-gray-700 mb-1">Valid for (Days)</label>
                <input type="number" name="days" required defaultValue={30} min={1} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Add
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3">Expense Name</th>
                    <th className="px-5 py-3">Total Amount</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Daily Cost (Amortized)</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeExpenses.length > 0 ? activeExpenses.map(exp => {
                    const start = new Date(exp.startDate).getTime();
                    const end = new Date(exp.endDate).getTime();
                    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
                    const dailyRate = Math.round(exp.amount / days);
                    
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">{exp.name}</td>
                        <td className="px-5 py-3 text-gray-600">Rp {exp.amount.toLocaleString('id-ID')}</td>
                        <td className="px-5 py-3 text-gray-600">{days} days</td>
                        <td className="px-5 py-3 font-medium text-red-600">- Rp {dailyRate.toLocaleString('id-ID')}/day</td>
                        <td className="px-5 py-3 text-right">
                          <form action={deleteExpense}>
                            <input type="hidden" name="id" value={exp.id} />
                            <button type="submit" className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-500">No operational expenses recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* BEST SELLERS SECTION */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Best Selling Items
            </h2>
          </div>
          <div className="p-5">
            {topProducts.length > 0 ? (
              <div className="space-y-4">
                {topProducts.map(([name, qty], index) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-700' : 
                        index === 1 ? 'bg-gray-100 text-gray-700' : 
                        index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700">{qty} sold</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-gray-500 py-4">No sales data yet.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
