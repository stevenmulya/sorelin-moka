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
    <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs mb-6">
      <div
        className="px-5 py-4 border-b border-[#E5D5BC] flex items-center justify-between bg-[#FAF0DA]/60 cursor-pointer hover:bg-[#FAF0DA] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#C88A32]" />
          <h2 className="text-sm font-bold text-[#6B4227]">Stock Movement History</h2>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-[#8E6D53] hover:text-[#6B4227] flex items-center gap-1 text-xs font-semibold bg-[#FFFDF8] border border-[#E5D5BC] px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" /> Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" /> View ({Math.min(logs.length, 10)})
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-[#E5D5BC]/60">
          {logs.length > 0 ? (
            logs.slice(0, 10).map((log) => {
              let sentence = '';
              let badgeColor = '';

              if (log.type === 'IN') {
                sentence = `${log.giver || 'Staff'} added ${log.quantity} units of ${log.product.name}`;
                badgeColor = 'bg-[#F0FDF4] text-emerald-700 border border-[#DCFCE7]';
              } else if (log.type === 'OUT') {
                sentence = `${log.receiver || 'Staff'} removed ${log.quantity} units of ${log.product.name}`;
                badgeColor = 'bg-[#FEF6E7] text-[#9E7324] border border-[#F3DBAA]';
              } else {
                const actor = log.giver || log.receiver;
                sentence = actor
                  ? `${actor} reset stock of ${log.product.name} to ${log.quantity} units`
                  : `Stock of ${log.product.name} reset to ${log.quantity} units`;
                badgeColor = 'bg-[#FAF5FF] text-[#7E22CE] border border-[#E9D5FF]';
              }

              if (log.notes) {
                sentence += ` (${log.notes})`;
              }

              return (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-[#FAF0DA]/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${badgeColor}`}>
                      {log.type}
                    </span>
                    <span className="text-sm font-medium text-[#3F2311]">{sentence}</span>
                  </div>
                  <div className="text-xs text-[#9E826B] font-medium whitespace-nowrap">{timeAgo(log.createdAt)}</div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-[#8E6D53] text-sm py-8">No stock movement history recorded yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
