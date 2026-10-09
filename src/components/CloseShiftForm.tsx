'use client';

import { LogOut } from 'lucide-react';
import { closeShift } from '@/app/actions';

export default function CloseShiftForm({ 
  shiftId, 
  expectedCash, 
  pendingCount,
  openedBy
}: { 
  shiftId: number, 
  expectedCash: number, 
  pendingCount: number,
  openedBy: string
}) {
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    let message = 'Are you sure you want to end this shift?';
    if (pendingCount > 0) {
      message = `WARNING: There are ${pendingCount} unpaid transaction(s) still "Waiting Payment". If you close the shift now, ALL of them will be permanently cancelled. Are you absolutely sure you want to continue?`;
    }
    
    if (!window.confirm(message)) {
      e.preventDefault();
    }
  };

  return (
    <form action={closeShift} onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="expectedCash" value={expectedCash} />
      
      <div>
        <label className="block text-sm font-bold text-gray-900 mb-1">Actual Cash (Rp)</label>
        <p className="text-xs text-gray-500 mb-2">How much cash is actually in the drawer right now?</p>
        <input type="number" name="actualCash" required placeholder="e.g. 150000" className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-base font-semibold focus:ring-2 focus:ring-gray-900 focus:outline-none" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Closed By</label>
        <input type="text" name="closedBy" required defaultValue={openedBy} placeholder="Cashier Name" className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:outline-none" />
      </div>

      {pendingCount > 0 && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-100 rounded-lg text-sm font-medium">
          ⚠️ {pendingCount} transactions will be cancelled.
        </div>
      )}

      <button type="submit" className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mt-4">
        <LogOut className="h-4 w-4" /> End Shift & Reconcile
      </button>
    </form>
  );
}
