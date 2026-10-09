'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar as CalendarIcon, ArrowRight } from 'lucide-react';

export default function DateFilter({ defaultStart, defaultEnd, activePreset }: { defaultStart: string, defaultEnd: string, activePreset?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyRange(e.target.value, defaultEnd, 'custom');
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyRange(defaultStart, e.target.value, 'custom');
  };

  const applyRange = (start: string, end: string, preset: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (preset !== 'custom') {
      params.set('preset', preset);
      params.delete('start');
      params.delete('end');
    } else {
      params.set('preset', 'custom');
      if (start) params.set('start', start);
      else params.delete('start');
      if (end) params.set('end', end);
      else params.delete('end');
    }
    
    router.push(`?${params.toString()}`);
  };

  const setPreset = (type: 'this_shift' | 'today' | 'week' | 'month' | 'all') => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const todayStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

    if (type === 'today') {
      applyRange(todayStr, todayStr, 'today');
    } else if (type === 'week') {
      const past = new Date(d);
      past.setDate(past.getDate() - 7);
      const pastStr = `${past.getFullYear()}-${pad(past.getMonth()+1)}-${pad(past.getDate())}`;
      applyRange(pastStr, todayStr, 'week');
    } else if (type === 'month') {
      const past = new Date(d);
      past.setDate(past.getDate() - 30);
      const pastStr = `${past.getFullYear()}-${pad(past.getMonth()+1)}-${pad(past.getDate())}`;
      applyRange(pastStr, todayStr, 'month');
    } else {
      applyRange('', '', type);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Quick Presets */}
      <div className="flex items-center bg-gray-100/80 rounded-lg p-1 border border-gray-200/50">
        <button onClick={() => setPreset('this_shift')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activePreset === 'this_shift' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>This Shift</button>
        <button onClick={() => setPreset('today')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activePreset === 'today' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>Today</button>
        <button onClick={() => setPreset('week')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activePreset === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>7 Days</button>
        <button onClick={() => setPreset('month')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activePreset === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>30 Days</button>
        <button onClick={() => setPreset('all')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activePreset === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>All Time</button>
      </div>

      {/* Custom Range */}
      <div className={`flex items-center gap-2 bg-white border ${activePreset === 'custom' ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-300'} rounded-lg px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-gray-400`}>
        <CalendarIcon className="h-4 w-4 text-gray-500" />
        <input
          key={`start-${defaultStart}`}
          type="date"
          defaultValue={defaultStart}
          onChange={handleStartChange}
          className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer w-32"
        />
        <ArrowRight className="h-3 w-3 text-gray-400" />
        <input
          key={`end-${defaultEnd}`}
          type="date"
          defaultValue={defaultEnd}
          onChange={handleEndChange}
          className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent cursor-pointer w-32"
        />
      </div>
    </div>
  );
}
