import { prisma } from '@/lib/prisma';
import { Plus } from 'lucide-react';
import DashboardKanban from '@/components/DashboardKanban';
import WaitingPaymentWidget from '@/components/WaitingPaymentWidget';
import DashboardMetrics from '@/components/DashboardMetrics';
import AutoRefresh from '@/components/AutoRefresh';
import Link from 'next/link';
import { connection } from 'next/server';
import { summarizeShift } from '@/lib/services/shifts';
import { KANBAN_STATUSES, LOW_STOCK_THRESHOLD, STATUS } from '@/lib/constants';

export const instant = false;

export default async function DashboardPage() {
  await connection();

  const [lowStockCount, activeShift] = await Promise.all([
    prisma.product.count({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, isActive: true },
    }),
    prisma.shift.findFirst({
      where: { status: 'Open' },
      orderBy: { startTime: 'desc' },
    }),
  ]);

  const [activeOrders, waitingPaymentItems, summary] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        status: { in: [...KANBAN_STATUSES] },
        shiftId: activeShift ? activeShift.id : -1,
      },
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    }),
    prisma.transaction.findMany({
      where: {
        status: STATUS.WAITING,
        shiftId: activeShift ? activeShift.id : -1,
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: { items: true },
    }),
    activeShift ? summarizeShift(prisma, activeShift.id) : null,
  ]);

  const shiftRevenue = summary?.revenue ?? 0;
  const cashRevenue = summary?.cashSales ?? 0;
  const qrisRevenue = summary?.qrisSales ?? 0;
  const debitRevenue = summary?.debitSales ?? 0;
  const shiftCogs = summary?.cogs ?? 0;
  const shiftOpex = summary?.expenses ?? 0;
  const shiftOrders = summary?.paidOrders ?? 0;
  const shiftNetProfit = shiftRevenue - shiftCogs - shiftOpex;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <AutoRefresh seconds={15} />

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
            opex={shiftOpex}
            netProfit={shiftNetProfit}
            periodLabel="This Shift"
            lowStockCount={lowStockCount}
          />

          {/* Quick Action */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-base">New Transaction</h3>
              <p className="text-xs text-gray-500 mt-0.5">Create a new order for a customer.</p>
            </div>
            <Link
              href="/transactions/new"
              className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
            >
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
