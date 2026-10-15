'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

function timeAgo(dateString: Date | string) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export interface StockLogItem {
  id: number;
  type: string;
  quantity: number;
  giver?: string | null;
  receiver?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  product: {
    name: string;
  };
}

export default function HistoryWidget({ logs }: { logs: StockLogItem[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#FFFDF9] border border-[#EADBCC] rounded-2xl overflow-hidden shadow-xs mb-6">
      <div 
        className="px-5 py-4 border-b border-[#EADBCC] flex items-center justify-between bg-[#FAF7F2] cursor-pointer hover:bg-[#FAF7F2]/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C69234]" />
          <h2 className="text-sm font-bold text-[#4A2E1B]">Stock Movement History</h2>
        </div>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-[#7A6251] hover:text-[#4A2E1B] flex items-center gap-1 text-xs font-semibold bg-[#FFFDF9] border border-[#EADBCC] px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
        >
          {expanded ? (
            <><ChevronUp className="h-4 w-4" /> Collapse</>
          ) : (
            <><ChevronDown className="h-4 w-4" /> View ({Math.min(logs.length, 10)})</>
          )}
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-[#EADBCC]/60">
          {logs.length > 0 ? (
            logs.slice(0, 10).map((log) => {
              let sentence = '';
              let badgeColor = '';
              
              if (log.type === 'IN') {
                sentence = `${log.giver || 'Someone'} added ${log.quantity} pcs of ${log.product.name}`;
                badgeColor = 'bg-[#F0FDF4] text-emerald-700 border border-[#DCFCE7]';
              } else if (log.type === 'OUT') {
                sentence = `${log.receiver || 'Someone'} removed ${log.quantity} pcs of ${log.product.name}`;
                badgeColor = 'bg-[#FEF6E7] text-[#9E7324] border border-[#F3E3BA]';
              } else {
                sentence = `Stock of ${log.product.name} reset to ${log.quantity} pcs`;
                badgeColor = 'bg-[#FAF5FF] text-[#7E22CE] border border-[#E9D5FF]';
              }

              if (log.notes) {
                sentence += ` (${log.notes})`;
              }

              return (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-[#FAF7F2]/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${badgeColor}`}>
                      {log.type}
                    </span>
                    <span className="text-sm font-medium text-[#382213]">
                      {sentence}
                    </span>
                  </div>
                  <div className="text-xs text-[#A89687] font-medium whitespace-nowrap">
                    {timeAgo(log.createdAt)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-[#7A6251] text-sm py-8">
              No stock movement history recorded yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
