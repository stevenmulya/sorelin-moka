'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';
import Link from 'next/link';

export default function WaitingPaymentWidget({ items }: { items: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items.slice(0, 10) : items.slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col h-full min-h-[300px]">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Waiting Payment</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
            {items.length} Orders
          </span>
          {items.length > 5 && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show Less</> : <><ChevronDown className="h-3 w-3" /> See All</>}
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
        {displayItems.length > 0 ? (
          displayItems.map((trx) => (
            <div key={trx.id} className="px-4 py-3 flex items-start justify-between hover:bg-gray-50 transition-colors">
              <div className="flex-1 pr-4">
                <p className="font-medium text-xs text-gray-900">{generateTrxCode(trx.id, trx.createdAt, trx.customer)}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-2">{trx.customer}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-medium text-xs text-gray-900">Rp {trx.amount.toLocaleString('id-ID')}</p>
                <Link href={`/transactions/${trx.id}`} className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md hover:bg-gray-800 transition-colors whitespace-nowrap mt-1">
                  Review
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-sm text-gray-500 flex-1 flex items-center justify-center">
            No orders waiting for payment.
          </div>
        )}
      </div>
    </div>
  );
}
