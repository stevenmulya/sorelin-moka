'use client';

import { updateTransactionStatus } from '@/app/actions';
import { Check, X } from 'lucide-react';

export default function TransactionActions({ id }: { id: number }) {
  return (
    <div className="flex items-center gap-2">
      <form 
        action={updateTransactionStatus} 
        onSubmit={(e) => {
          if (!confirm('Mark payment as SUCCESS? (Order will go to Preparing)')) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="Preparing" />
        <button type="submit" className="p-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md transition-colors" title="Payment Success">
          <Check className="h-4 w-4" />
        </button>
      </form>

      <form 
        action={updateTransactionStatus}
        onSubmit={(e) => {
          if (!confirm('Are you sure you want to cancel this transaction? (Status: Cancelled)')) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="Cancelled" />
        <button type="submit" className="p-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors" title="Cancel Transaction">
          <X className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
