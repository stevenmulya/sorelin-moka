import { PrismaClient } from '@prisma/client';
import { AlertTriangle, TrendingUp, Calendar, Wallet, Plus } from "lucide-react";
import DashboardKanban from '@/components/DashboardKanban';
import WaitingPaymentWidget from '@/components/WaitingPaymentWidget';
import Link from 'next/link';

import { connection } from 'next/server';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function DashboardPage() {
  await connection();
  const lowStockCount = await prisma.product.count({
    where: { stock: { lte: 5 } }
  });

  const waitingPaymentItems = await prisma.transaction.findMany({
    where: { status: 'Waiting Payment' },
    orderBy: { createdAt: 'asc' },
    take: 10,
    include: { items: true }
  });

  const activeOrders = await prisma.transaction.findMany({
    where: { status: { in: ['Preparing', 'Ready for Pickup', 'Picked Up'] } },
    orderBy: { createdAt: 'desc' },
    include: { items: true }
  });

  // Get start of today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today's paid transactions
  const todaysPaidTransactions = await prisma.transaction.findMany({
    where: { 
      status: { in: ['Preparing', 'Ready for Pickup', 'Picked Up', 'Closed'] },
      createdAt: { gte: today }
    },
    include: { items: true }
  });

  // OPEX calculation
  const activeExpenses = await prisma.expense.findMany();
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

  // Calculate Today's Revenue and Net Profit
  let todaysRevenue = 0;
  let todaysNetProfit = 0;
  let todaysOrders = todaysPaidTransactions.length;

  for (const trx of todaysPaidTransactions) {
    todaysRevenue += trx.amount;
    
    // Calculate total cost for this transaction
    let totalCost = 0;
    for (const item of trx.items) {
      totalCost += item.quantity * item.costPrice;
    }
    
    todaysNetProfit += (trx.amount - totalCost);
  }

  todaysNetProfit -= todayApportionedOpex;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Waiting Payment */}
        <WaitingPaymentWidget items={waitingPaymentItems} />

        {/* Right Column: Stack of Summaries + Low Stock */}
        <div className="flex flex-col gap-4 h-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <p className="text-xs font-medium text-gray-500">Today's Orders</p>
              </div>
              <h3 className="text-sm font-bold text-gray-900">{todaysOrders} orders</h3>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-medium text-gray-500">Today's Revenue</p>
              </div>
              <h3 className="text-sm font-bold text-gray-900">Rp {todaysRevenue.toLocaleString('id-ID')}</h3>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <p className="text-xs font-medium text-gray-500">Net Profit</p>
              </div>
              <h3 className="text-sm font-bold text-gray-900">Rp {Math.round(todaysNetProfit).toLocaleString('id-ID')}</h3>
            </div>
          </div>

          {/* Widget 2: Low Stock Alert */}
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-sm flex flex-col justify-center p-6 bg-red-50/30 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{lowStockCount} Items Low Stock</h3>
                  <p className="text-xs text-gray-600 mt-0.5">Please restock soon.</p>
                </div>
              </div>
              <Link href="/inventory" className="px-4 py-2 bg-red-600 text-white rounded-md font-medium text-xs hover:bg-red-700 transition-colors shadow-sm">
                Details
              </Link>
            </div>
          </div>

          {/* Widget 3: Quick Action */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">New Transaction</h3>
              <p className="text-xs text-gray-500 mt-0.5">Create a new order for a customer.</p>
            </div>
            <Link href="/transactions/new" className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create
            </Link>
          </div>
        </div>
      </div>

      {/* Kanban Orders */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 tracking-tight">Active Orders</h2>
        <DashboardKanban initialOrders={activeOrders} />
      </div>
    </div>
  );
}
