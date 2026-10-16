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
            confirmMessage="Mark this order as Ready for Pickup?"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={STATUS.READY} />
            <SubmitButton
              pendingText="..."
              className="px-3 py-1.5 bg-[#FAF0DA] text-[#6B4227] border border-[#E5D5BC] hover:bg-[#F2E6CF] rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Mark Ready for Pickup"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-[#C88A32]" /> Ready for Pickup
            </SubmitButton>
          </ActionForm>

          <ActionForm
            action={cancelTransaction}
            confirmMessage="Cancel this order and restore stock?"
            reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
          >
            <input type="hidden" name="transactionId" value={id} />
            <SubmitButton
              pendingText="..."
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Cancel Order"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </SubmitButton>
          </ActionForm>
        </>
      )}

      {status === STATUS.READY && (
        <>
          <ActionForm
            action={updateTransactionStatus}
            confirmMessage="Mark this order as Picked Up by the customer?"
          >
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={STATUS.PICKED_UP} />
            <SubmitButton
              pendingText="..."
              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Mark Picked Up"
            >
              <PackageCheck className="h-3.5 w-3.5" /> Picked Up
            </SubmitButton>
          </ActionForm>

          <ActionForm
            action={cancelTransaction}
            confirmMessage="Cancel this order and restore stock?"
            reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
          >
            <input type="hidden" name="transactionId" value={id} />
            <SubmitButton
              pendingText="..."
              className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1.5"
              title="Cancel Order"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </SubmitButton>
          </ActionForm>
        </>
      )}
    </div>
  );
}
