'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import Link from 'next/link';

export interface WaitingPaymentItem {
  id: number;
  customer?: string | null;
  amount: number;
  createdAt: Date | string;
  selfieUrl?: string | null;
}

export default function WaitingPaymentWidget({ items }: { items: WaitingPaymentItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayItems = expanded ? items : items.slice(0, 5);

  return (
    <div className="bg-[#FFFDF8] rounded-2xl border border-[#E5D5BC] overflow-hidden shadow-xs flex flex-col h-full min-h-[300px]">
      <div className="p-4 border-b border-[#E5D5BC] flex items-center justify-between bg-[#FAF0DA]/60">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C88A32]" />
          <h3 className="font-bold text-[#3F2311] text-sm">Waiting Payment</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[#F3DBAA] text-[#3F2311] border border-[#E5D5BC] text-xs font-semibold px-2 py-0.5 rounded-full">
            {items.length} Orders
          </span>
          {items.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-[#8E6D53] hover:text-[#3F2311] flex items-center gap-1 transition-colors cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> See All ({items.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="divide-y divide-[#E5D5BC]/60 flex-1 overflow-y-auto">
        {displayItems.length > 0 ? (
          displayItems.map((trx) => (
            <div
              key={trx.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-[#FAF0DA]/40 transition-colors gap-3"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {trx.selfieUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={trx.selfieUrl}
                    alt={trx.customer || 'Customer'}
                    className="w-9 h-9 rounded-full object-cover border border-[#E5D5BC] flex-shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#FAF0DA] border border-[#E5D5BC] text-[#6B4227] text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {(trx.customer || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xs text-[#3F2311] truncate">
                    {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
                  </p>
                  <p className="text-[11px] text-[#8E6D53] truncate">{trx.customer || 'Guest'}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <p className="font-semibold text-xs text-[#3F2311]">{formatRupiah(trx.amount)}</p>
                <Link
                  href={`/transactions/${trx.id}`}
                  className="px-2.5 py-1 bg-[#6B4227] text-[#FAF0DA] text-[11px] font-semibold rounded-lg hover:bg-[#54311B] transition-colors whitespace-nowrap"
                >
                  Review
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-sm text-[#8E6D53] flex-1 flex items-center justify-center">
            No orders waiting for payment.
          </div>
        )}
      </div>
    </div>
  );
}
