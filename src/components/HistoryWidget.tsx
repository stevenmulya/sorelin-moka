'use client';

import { useState } from 'react';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';

function timeAgo(dateString: Date | string) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

export default function HistoryWidget({ logs }: { logs: any[] }) {
  const [expanded, setExpanded] = useState(false);

  const displayLogs = expanded ? logs.slice(0, 5) : [];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-8">
      <div 
        className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Stock Movement History</h2>
        </div>
        <button className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-xs font-medium bg-gray-100 px-3 py-1.5 rounded-md">
          {expanded ? (
            <><ChevronUp className="h-4 w-4" /> Collapse</>
          ) : (
            <><ChevronDown className="h-4 w-4" /> Expand ({Math.min(logs.length, 5)})</>
          )}
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {displayLogs.length > 0 ? (
          displayLogs.map((log: any) => {
            let sentence = '';
            let badgeColor = '';
            
            if (log.type === 'IN') {
              sentence = `${log.giver || 'Someone'} added ${log.quantity} pcs of ${log.product.name}`;
              badgeColor = 'bg-emerald-100 text-emerald-700';
            } else if (log.type === 'OUT') {
              sentence = `${log.receiver || 'Someone'} deducted ${log.quantity} pcs of ${log.product.name}`;
              badgeColor = 'bg-amber-100 text-amber-700';
            } else {
              sentence = `System reset ${log.product.name} stock to ${log.quantity} pcs`;
              badgeColor = 'bg-gray-100 text-gray-700';
            }

            if (log.notes) {
              sentence += ` (${log.notes})`;
            }

            return (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${badgeColor}`}>
                    {log.type}
                  </span>
                  <span className="text-sm text-gray-700">
                    {sentence}
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-medium whitespace-nowrap">
                  {timeAgo(log.createdAt)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-500 text-sm py-8">
            No stock movements recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
