'use client';

import { useState } from 'react';
import { TrendingUp, Calendar, Wallet, X, Info, AlertTriangle } from 'lucide-react';

import { formatRupiah } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardMetrics({
  ordersCount,
  revenue,
  cashRevenue = 0,
  qrisRevenue = 0,
  debitRevenue = 0,
  cogs,
  opex,
  netProfit,
  periodLabel = "Today",
  lowStockCount = 0
}: {
  ordersCount: number;
  revenue: number;
  cashRevenue?: number;
  qrisRevenue?: number;
  debitRevenue?: number;
  cogs: number;
  opex: number;
  netProfit: number;
  periodLabel?: string;
  lowStockCount?: number;
}) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const grossProfit = revenue - cogs;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        {/* Orders Card */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] p-5 shadow-xs flex flex-col justify-center relative group hover:border-[#D8C6B5] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <Link href="/transactions?view=shift" className="flex items-center gap-2 hover:opacity-80">
              <Calendar className="h-4 w-4 text-[#C69234]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7A6251]">{periodLabel} Orders</p>
            </Link>
            <button onClick={() => setActiveModal('orders')} className="text-[#A69383] hover:text-[#4A2E1B] transition-colors" title="Orders Calculation">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <Link href="/transactions?view=shift">
            <h3 className="text-2xl font-bold tracking-tight text-[#4A2E1B]">{ordersCount} <span className="text-xs font-normal text-[#7A6251]">orders</span></h3>
          </Link>
        </div>

        {/* Revenue Card */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] p-5 shadow-xs flex flex-col justify-center relative group hover:border-[#D8C6B5] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7A6251]">{periodLabel} Revenue</p>
            </div>
            <button onClick={() => setActiveModal('revenue')} className="text-[#A69383] hover:text-[#4A2E1B] transition-colors" title="Revenue Breakdown">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[#4A2E1B]">{formatRupiah(revenue)}</h3>
        </div>

        {/* Net Profit Card */}
        <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] p-5 shadow-xs flex flex-col justify-center relative group hover:border-[#D8C6B5] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#7A4E0B]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7A6251]">Net Profit</p>
            </div>
            <button onClick={() => setActiveModal('profit')} className="text-[#A69383] hover:text-[#4A2E1B] transition-colors" title="Net Profit Calculation">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[#4A2E1B]">{formatRupiah(netProfit)}</h3>
        </div>

        {/* Low Stock Alert Card */}
        <Link href="/inventory" className="bg-[#FEF2F2] rounded-2xl border border-[#FECACA] p-5 shadow-xs flex flex-col justify-center relative group hover:border-[#FCA5A5] transition-colors cursor-pointer block">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded-full bg-[#FEE2E2] flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-red-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-800">Stock Alert</p>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-red-800">{lowStockCount} <span className="text-xs font-normal text-red-700">low stock</span></h3>
        </Link>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#28170D]/50 backdrop-blur-xs">
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-[#EADBCC] flex items-center justify-between bg-[#FAF7F2]">
              <h3 className="font-bold text-[#4A2E1B]">
                {activeModal === 'orders' && 'Orders Calculation'}
                {activeModal === 'revenue' && 'Revenue Breakdown'}
                {activeModal === 'profit' && 'Net Profit Calculation'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-[#7A6251] hover:bg-[#FAF7F2] hover:text-[#4A2E1B] rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
              {activeModal === 'orders' && (
                <div className="space-y-4 text-sm">
                  <p className="text-[#6B5344] leading-relaxed">
                    This is the total count of all transactions generated during this shift that have progressed past the &quot;Waiting Payment&quot; stage. Cancelled or unpaid orders are strictly excluded from this count.
                  </p>
                  <div className="flex justify-between font-bold text-[#4A2E1B] pt-4 border-t border-[#EADBCC]">
                    <span>Valid Orders</span>
                    <span>{ordersCount}</span>
                  </div>
                  <div className="pt-2">
                    <Link href="/transactions?view=shift" className="text-[#C69234] hover:underline font-semibold">
                      View all transactions →
                    </Link>
                  </div>
                </div>
              )}

              {activeModal === 'revenue' && (
                <div className="space-y-4 text-sm">
                  <p className="text-[#7A6251] mb-6">
                    Breakdown of total revenue based on payment methods for this shift.
                  </p>
                  
                  <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-3 border border-[#EADBCC]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="font-medium text-[#6B5344]">Cash</span>
                      </div>
                      <span className="font-semibold text-[#4A2E1B]">{formatRupiah(cashRevenue)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="font-medium text-[#6B5344]">QRIS</span>
                      </div>
                      <span className="font-semibold text-[#4A2E1B]">{formatRupiah(qrisRevenue)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#C69234]"></div>
                        <span className="font-medium text-[#6B5344]">Debit/Credit</span>
                      </div>
                      <span className="font-semibold text-[#4A2E1B]">{formatRupiah(debitRevenue)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 mt-4">
                    <span className="font-bold text-[#166534]">Total Revenue</span>
                    <span className="font-bold text-[#166534] text-lg">{formatRupiah(revenue)}</span>
                  </div>
                </div>
              )}

              {activeModal === 'profit' && (
                <div className="space-y-4 text-sm">
                  <p className="text-[#7A6251] mb-6">
                    True net profit calculation after deducting item costs and daily operational expenses.
                  </p>

                  <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-3 border border-[#EADBCC]">
                    <div className="flex justify-between items-center">
                      <span className="text-[#6B5344] font-medium">Gross Revenue</span>
                      <span className="font-semibold text-[#4A2E1B]">{formatRupiah(revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Total COGS</span>
                      <span>{formatRupiah(cogs)}</span>
                    </div>
                    
                    <div className="h-px bg-[#EADBCC] my-2"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#4A2E1B]">Gross Profit</span>
                      <span className="font-bold text-[#4A2E1B]">{formatRupiah(grossProfit)}</span>
                    </div>
                  </div>

                  <div className="bg-[#FAF7F2] rounded-xl p-4 space-y-3 border border-[#EADBCC] mt-4">
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Apportioned OPEX</span>
                      <span>{formatRupiah(opex)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-[#3D2413] border border-[#4A2E1B] rounded-xl p-4 mt-4">
                    <span className="font-bold text-[#FFFDF9]">True Net Profit</span>
                    <span className="font-bold text-[#FDF0D0] text-lg">{formatRupiah(netProfit)}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#EADBCC] flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl text-sm font-semibold hover:bg-[#3D2413] transition-colors shadow-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
