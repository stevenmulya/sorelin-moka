'use client';

import { updateTransactionStatus } from '@/app/actions';
import { CheckCircle2, XCircle, PackageCheck } from 'lucide-react';

export default function OrderActions({ id, status }: { id: number, status: string }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      {status === 'Preparing' && (
        <>
          <form 
            action={updateTransactionStatus} 
            onSubmit={(e) => {
              if (!confirm('Mark this order as READY?')) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="Ready" />
            <button type="submit" className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" title="Mark Ready">
              <CheckCircle2 className="h-4 w-4" /> Ready
            </button>
          </form>

          <form 
            action={updateTransactionStatus}
            onSubmit={(e) => {
              if (!confirm('Cancel this order?')) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="Cancelled" />
            <button type="submit" className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" title="Cancel">
              <XCircle className="h-4 w-4" /> Cancel
            </button>
          </form>
        </>
      )}

      {status === 'Ready for Pickup' && (
        <form 
          action={updateTransactionStatus} 
          onSubmit={(e) => {
            if (!confirm('Mark this order as COMPLETED (Picked up by customer)?')) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="Completed" />
          <button type="submit" className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" title="Complete">
            <PackageCheck className="h-4 w-4" /> Completed
          </button>
        </form>
      )}
    </div>
  );
}
