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

  const displayLogs = expanded ? logs.slice(0, 5) : logs.slice(0, 1);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-6">
      <div 
        className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Stock Movement History</h2>
        </div>
        <button className="text-gray-500 hover:text-gray-900 flex items-center gap-1 text-xs font-medium">
          {expanded ? (
            <><ChevronUp className="h-3.5 w-3.5" /> Show Less</>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5" /> Show All ({Math.min(logs.length, 5)})</>
          )}
        </button>
      </div>
      <div className="p-3.5 space-y-3">
        {displayLogs.length > 0 ? (
          displayLogs.map((log: any) => {
            let sentence = '';
            let badgeColor = '';
            
            if (log.type === 'IN') {
              sentence = `${log.giver || 'Someone'} added ${log.quantity} pcs of ${log.product.name}`;
              badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (log.type === 'OUT') {
              sentence = `${log.receiver || 'Someone'} deducted ${log.quantity} pcs of ${log.product.name}`;
              badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            } else {
              sentence = `System reset ${log.product.name} stock to ${log.quantity} pcs`;
              badgeColor = 'bg-gray-100 text-gray-800 border-gray-200';
            }

            if (log.notes) {
              sentence += ` because ${log.notes}`;
            }

            return (
              <div key={log.id} className="relative pl-4 pb-3 border-l border-gray-200 last:border-0 last:pb-0">
                <div className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border bg-white ${badgeColor.replace('bg-', 'border-').replace('text-', 'border-')}`} />
                <div className="text-xs text-gray-800 leading-snug">
                  <span className="font-medium text-gray-900">{sentence}</span>
                  <span className="text-gray-400 ml-2">({timeAgo(log.createdAt)})</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center text-gray-400 text-xs py-2">
            No stock movements yet.
          </div>
        )}
      </div>
    </div>
  );
}
