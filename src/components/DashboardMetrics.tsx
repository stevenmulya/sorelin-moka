'use client';

import { useState } from 'react';
import { TrendingUp, Calendar, Wallet, X, Info, AlertTriangle } from 'lucide-react';

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
        <Link href="/transactions?view=shift" className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-center relative group hover:border-gray-300 transition-colors cursor-pointer block">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-gray-500">{periodLabel} Orders</p>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">{ordersCount} <span className="text-sm font-normal text-gray-500">orders</span></h3>
        </Link>

        {/* Revenue Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-center relative group hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-medium text-gray-500">{periodLabel} Revenue</p>
            </div>
            <button onClick={() => setActiveModal('revenue')} className="text-gray-400 hover:text-gray-900 transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Rp {revenue.toLocaleString('id-ID')}</h3>
        </div>

        {/* Net Profit Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col justify-center relative group hover:border-gray-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-medium text-gray-500">Net Profit</p>
            </div>
            <button onClick={() => setActiveModal('profit')} className="text-gray-400 hover:text-gray-900 transition-colors">
              <Info className="h-4 w-4" />
            </button>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Rp {Math.round(netProfit).toLocaleString('id-ID')}</h3>
        </div>

        {/* Low Stock Alert Card */}
        <Link href="/inventory" className="bg-red-50/50 rounded-xl border border-red-100 p-5 shadow-sm flex flex-col justify-center relative group hover:border-red-200 transition-colors cursor-pointer block">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-3 w-3 text-red-600" />
            </div>
            <p className="text-xs font-medium text-red-700">Stock Alert</p>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">{lowStockCount} <span className="text-sm font-normal text-gray-500">low stock</span></h3>
        </Link>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-semibold text-gray-900">
                {activeModal === 'orders' && 'Orders Calculation'}
                {activeModal === 'revenue' && 'Revenue Breakdown'}
                {activeModal === 'profit' && 'Net Profit Calculation'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-6">
              {activeModal === 'orders' && (
                <div className="space-y-4 text-sm">
                  <p className="text-gray-600 leading-relaxed">
                    This is the total count of all transactions generated during this shift that have progressed past the "Waiting Payment" stage. Cancelled or unpaid orders are strictly excluded from this count.
                  </p>
                  <div className="flex justify-between font-bold text-gray-900 pt-4 border-t border-gray-100">
                    <span>Valid Orders</span>
                    <span>{ordersCount}</span>
                  </div>
                  <div className="pt-2">
                    <Link href="/transactions?view=shift" className="text-blue-600 hover:underline">
                      View all transactions →
                    </Link>
                  </div>
                </div>
              )}

              {activeModal === 'revenue' && (
                <div className="space-y-4 text-sm">
                  <p className="text-gray-500 mb-6">
                    Breakdown of total revenue based on payment methods for this shift.
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="font-medium text-gray-700">Cash</span>
                      </div>
                      <span className="font-semibold text-gray-900">Rp {cashRevenue.toLocaleString('id-ID')}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="font-medium text-gray-700">QRIS</span>
                      </div>
                      <span className="font-semibold text-gray-900">Rp {qrisRevenue.toLocaleString('id-ID')}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="font-medium text-gray-700">Debit/Credit</span>
                      </div>
                      <span className="font-semibold text-gray-900">Rp {debitRevenue.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-emerald-50 rounded-lg p-4 mt-4">
                    <span className="font-bold text-emerald-800">Total Revenue</span>
                    <span className="font-bold text-emerald-700 text-lg">Rp {revenue.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              {activeModal === 'profit' && (
                <div className="space-y-4 text-sm">
                  <p className="text-gray-500 mb-6">
                    True net profit calculation after deducting item costs and daily operational expenses.
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Gross Revenue</span>
                      <span className="font-semibold text-gray-900">Rp {revenue.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Total COGS</span>
                      <span>Rp {cogs.toLocaleString('id-ID')}</span>
                    </div>
                    
                    <div className="h-px bg-gray-200 my-2"></div>
                    
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">Gross Profit</span>
                      <span className="font-bold text-gray-900">Rp {grossProfit.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100 mt-4">
                    <div className="flex justify-between items-center text-red-600">
                      <span>- Apportioned OPEX</span>
                      <span>Rp {Math.round(opex).toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-gray-900 rounded-lg p-4 mt-4">
                    <span className="font-bold text-white">True Net Profit</span>
                    <span className="font-bold text-emerald-400 text-lg">Rp {Math.round(netProfit).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
