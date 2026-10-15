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
    
    params.set('preset', preset);
    if (preset !== 'custom') {
      params.delete('start');
      params.delete('end');
    } else {
      if (start) params.set('start', start);
      else params.delete('start');
      if (end) params.set('end', end);
      else params.delete('end');
    }
    
    router.push(`?${params.toString()}`);
  };

  const setPreset = (type: 'this_shift' | 'today' | 'week' | 'month' | 'all') => {
    applyRange('', '', type);
  };

  const presets: { id: 'this_shift' | 'today' | 'week' | 'month' | 'all'; label: string }[] = [
    { id: 'this_shift', label: 'This Shift' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 Days' },
    { id: 'month', label: '30 Days' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full">
      {/* Quick Presets */}
      <div className="flex items-center flex-wrap gap-1 p-1 bg-[#FAF7F2] rounded-xl border border-[#EADBCC]">
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#4A2E1B] text-[#FFFDF9] shadow-xs'
                  : 'text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FFFDF9]'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Range */}
      <div
        className={`flex items-center gap-2 bg-[#FAF7F2] border rounded-xl px-3.5 py-1.5 transition-all self-start lg:self-auto ${
          activePreset === 'custom'
            ? 'border-[#4A2E1B] ring-2 ring-[#4A2E1B]/15 bg-[#FFFDF9]'
            : 'border-[#EADBCC]'
        }`}
      >
        <CalendarIcon className="h-4 w-4 text-[#C69234] flex-shrink-0" />
        <input
          key={`start-${defaultStart}`}
          type="date"
          defaultValue={defaultStart}
          onChange={handleStartChange}
          aria-label="Start date"
          className="text-xs font-semibold text-[#382213] focus:outline-none bg-transparent cursor-pointer w-28 sm:w-32"
        />
        <ArrowRight className="h-3 w-3 text-[#A89687] flex-shrink-0" />
        <input
          key={`end-${defaultEnd}`}
          type="date"
          defaultValue={defaultEnd}
          onChange={handleEndChange}
          aria-label="End date"
          className="text-xs font-semibold text-[#382213] focus:outline-none bg-transparent cursor-pointer w-28 sm:w-32"
        />
      </div>
    </div>
  );
}
