'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';
import Link from 'next/link';

export interface WaitingPaymentItem {
  id: number;
  customer?: string | null;
  amount: number;
  createdAt: Date | string;
}

export default function WaitingPaymentWidget({ items }: { items: WaitingPaymentItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items.slice(0, 10) : items.slice(0, 5);

  return (
    <div className="bg-[#FFFDF9] rounded-2xl border border-[#EADBCC] overflow-hidden shadow-xs flex flex-col h-full min-h-[300px]">
      <div className="p-4 border-b border-[#EADBCC] flex items-center justify-between bg-[#FAF7F2]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C69234]" />
          <h3 className="font-bold text-[#4A2E1B] text-sm">Waiting Payment</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[#FDF0D0] text-[#7A4E0B] border border-[#F2DB94] text-xs font-semibold px-2 py-0.5 rounded-full">
            {items.length} Orders
          </span>
          {items.length > 5 && (
            <button 
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-[#7A6251] hover:text-[#4A2E1B] flex items-center gap-1 transition-colors"
            >
              {expanded ? <><ChevronUp className="h-3 w-3" /> Show Less</> : <><ChevronDown className="h-3 w-3" /> See All</>}
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-[#EADBCC]/60 flex-1 overflow-y-auto">
        {displayItems.length > 0 ? (
          displayItems.map((trx) => (
            <div key={trx.id} className="px-4 py-3 flex items-start justify-between hover:bg-[#FAF7F2] transition-colors">
              <div className="flex-1 pr-4">
                <p className="font-semibold text-xs text-[#382213]">{generateTrxCode(trx.id, trx.createdAt, trx.customer)}</p>
                <p className="text-[11px] text-[#7A6251] mt-0.5 mb-2">{trx.customer}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="font-semibold text-xs text-[#382213]">Rp {trx.amount.toLocaleString('id-ID')}</p>
                <Link href={`/transactions/${trx.id}`} className="px-2.5 py-1 bg-[#4A2E1B] text-[#FFFDF9] text-[11px] font-semibold rounded-lg hover:bg-[#3D2413] transition-colors whitespace-nowrap mt-1">
                  Review
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-sm text-[#7A6251] flex-1 flex items-center justify-center">
            No orders waiting for payment.
          </div>
        )}
      </div>
    </div>
  );
}
