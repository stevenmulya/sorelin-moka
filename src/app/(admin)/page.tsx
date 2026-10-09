import { PrismaClient } from '@prisma/client';
import { TrendingUp, Calendar, Wallet, Plus } from "lucide-react";
import DashboardKanban from '@/components/DashboardKanban';
import WaitingPaymentWidget from '@/components/WaitingPaymentWidget';
import DashboardMetrics from '@/components/DashboardMetrics';
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

  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  const waitingPaymentItems = await prisma.transaction.findMany({
    where: { 
      status: 'Waiting Payment',
      shiftId: activeShift ? activeShift.id : -1
    },
    orderBy: { createdAt: 'asc' },
    take: 10,
    include: { items: true }
  });

  const activeOrders = await prisma.transaction.findMany({
    where: { 
      status: { in: ['Preparing', 'Ready for Pickup', 'Picked Up'] }
    },
    orderBy: { createdAt: 'asc' },
    include: { items: true }
  });

  // Shift's paid transactions
  const shiftPaidTransactions = await prisma.transaction.findMany({
    where: { 
      status: { in: ['Preparing', 'Ready for Pickup', 'Picked Up', 'Closed'] },
      shiftId: activeShift ? activeShift.id : -1
    },
    include: { items: true }
  });

  // Shift's OPEX calculation
  const shiftExpenses = await prisma.expense.findMany({
    where: { shiftId: activeShift ? activeShift.id : -1 }
  });
  
  let shiftApportionedOpex = 0;
  for (const exp of shiftExpenses) {
    shiftApportionedOpex += exp.amount;
  }

  // Calculate Shift's Revenue and Net Profit
  let shiftRevenue = 0;
  let cashRevenue = 0;
  let qrisRevenue = 0;
  let debitRevenue = 0;
  
  let shiftCogs = 0;
  let shiftNetProfit = 0;
  let shiftOrders = shiftPaidTransactions.length;

  for (const trx of shiftPaidTransactions) {
    shiftRevenue += trx.amount;
    if (trx.paymentMethod === 'Cash' || !trx.paymentMethod) cashRevenue += trx.amount;
    else if (trx.paymentMethod === 'QRIS') qrisRevenue += trx.amount;
    else if (trx.paymentMethod === 'Debit') debitRevenue += trx.amount;
    
    // Calculate total cost for this transaction
    let totalCost = 0;
    for (const item of trx.items) {
      totalCost += item.quantity * item.costPrice;
    }
    shiftCogs += totalCost;
    shiftNetProfit += (trx.amount - totalCost);
  }

  shiftNetProfit -= shiftApportionedOpex;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Waiting Payment */}
        <WaitingPaymentWidget items={waitingPaymentItems} />

        {/* Right Column: Stack of Summaries + Low Stock */}
        <div className="flex flex-col gap-4 h-full">
          <DashboardMetrics 
            ordersCount={shiftOrders} 
            revenue={shiftRevenue}
            cashRevenue={cashRevenue}
            qrisRevenue={qrisRevenue}
            debitRevenue={debitRevenue}
            cogs={shiftCogs} 
            opex={shiftApportionedOpex} 
            netProfit={shiftNetProfit}
            periodLabel="This Shift"
            lowStockCount={lowStockCount}
          />

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
