'use client';

import { cancelTransaction, updateTransactionStatus } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { CheckCircle2, XCircle, PackageCheck } from 'lucide-react';
import { STATUS } from '@/lib/constants';

export default function OrderActions({ id, status }: { id: number; status: string }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      {status === STATUS.PREPARING && (
        <>
          <ActionForm 
            action={updateTransactionStatus} 
            confirmMessage="Mark this order as READY for pickup?"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={STATUS.READY} />
            <SubmitButton 
              pendingText="..."
              className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" 
              title="Mark Ready"
            >
              <CheckCircle2 className="h-4 w-4" /> Ready for Pickup
            </SubmitButton>
          </ActionForm>

          <ActionForm 
            action={cancelTransaction} 
            confirmMessage="Cancel this order and revert stock?"
            reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
          >
            <input type="hidden" name="transactionId" value={id} />
            <SubmitButton 
              pendingText="..."
              className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" 
              title="Cancel"
            >
              <XCircle className="h-4 w-4" /> Cancel
            </SubmitButton>
          </ActionForm>
        </>
      )}

      {status === STATUS.READY && (
        <>
          <ActionForm 
            action={updateTransactionStatus} 
            confirmMessage="Mark this order as PICKED UP by customer?"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={STATUS.PICKED_UP} />
            <SubmitButton 
              pendingText="..."
              className="px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" 
              title="Mark Picked Up"
            >
              <PackageCheck className="h-4 w-4" /> Picked Up
            </SubmitButton>
          </ActionForm>

          <ActionForm 
            action={cancelTransaction} 
            confirmMessage="Cancel this order and revert stock?"
            reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
          >
            <input type="hidden" name="transactionId" value={id} />
            <SubmitButton 
              pendingText="..."
              className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md transition-colors text-xs font-medium flex items-center gap-1.5" 
              title="Cancel"
            >
              <XCircle className="h-4 w-4" /> Cancel
            </SubmitButton>
          </ActionForm>
        </>
      )}
    </div>
  );
}
