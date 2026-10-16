import { prisma } from '@/lib/prisma';
import { Plus } from 'lucide-react';
import DashboardKanban from '@/components/DashboardKanban';
import WaitingPaymentWidget from '@/components/WaitingPaymentWidget';
import DashboardMetrics from '@/components/DashboardMetrics';
import AutoRefresh from '@/components/AutoRefresh';
import Link from 'next/link';
import { connection } from 'next/server';
import { getActiveShift, summarizeShift } from '@/lib/services/shifts';
import { KANBAN_STATUSES, LOW_STOCK_THRESHOLD, MAX_WAITING_ORDERS, STATUS } from '@/lib/constants';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function DashboardPage() {
  await connection();

  const [lowStockCount, activeShift] = await Promise.all([
    prisma.product.count({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, isActive: true },
    }),
    getActiveShift(),
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
      take: MAX_WAITING_ORDERS,
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
          <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] shadow-xs p-6 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#6B4227] text-base">New Order</h3>
              <p className="text-xs text-[#8E6D53] mt-0.5">Create a new order for a customer.</p>
            </div>
            <Link
              href="/transactions/new"
              className="px-5 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Order
            </Link>
          </div>
        </div>
      </div>

      {/* Kanban Orders */}
      <div>
        <h2 className="text-lg font-bold text-[#6B4227] mb-4 tracking-tight">Active Orders</h2>
        <DashboardKanban initialOrders={activeOrders} />
      </div>
    </div>
  );
}
