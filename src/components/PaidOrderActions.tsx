'use client';

import { useState } from 'react';
import { editPaymentMethod, cancelTransaction } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { Settings2, Ban, Edit3, Check } from 'lucide-react';
import { STATUS } from '@/lib/constants';
import { formatRupiah } from '@/lib/utils';

export default function PaidOrderActions({
  trxId,
  trxAmount,
  currentMethod,
  currentPaidAmount,
  status,
}: {
  trxId: number;
  trxAmount: number;
  currentMethod: string;
  currentPaidAmount: number;
  status?: string;
}) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'cancel'>('idle');
  const [method, setMethod] = useState<'Cash' | 'QRIS' | 'Debit'>(
    (currentMethod as 'Cash' | 'QRIS' | 'Debit') || 'Cash'
  );
  const [paidAmount, setPaidAmount] = useState<string>(
    String(currentPaidAmount || trxAmount)
  );

  return (
    <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-[#E5D5BC] pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#C88A32]" />
          <h3 className="font-bold text-[#3F2311] text-sm">Manage Order</h3>
        </div>
        {mode === 'idle' && (
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
            <Check className="h-3 w-3" /> Paid ({currentMethod || 'Cash'})
          </span>
        )}
      </div>

      {mode === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className="flex-1 py-2 px-3 bg-[#FAF0DA] hover:bg-[#F2E6CF] text-[#6B4227] border border-[#E5D5BC] rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Payment Method
          </button>
          <button
            type="button"
            onClick={() => setMode('cancel')}
            className="flex-1 py-2 px-3 bg-[#FFFDF8] hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Ban className="h-3.5 w-3.5" /> Cancel Order
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#3F2311]">Update Payment Information</p>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="text-xs text-[#8E6D53] hover:text-[#3F2311] font-medium cursor-pointer"
            >
              Close
            </button>
          </div>

          <ActionForm
            action={editPaymentMethod}
            confirmMessage="Save payment changes?"
            onSuccess={() => setMode('idle')}
            className="space-y-3"
          >
            <input type="hidden" name="transactionId" value={trxId} />
            <input type="hidden" name="paymentMethod" value={method} />

            <div>
              <label className="block text-xs font-semibold text-[#3F2311] mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Cash', 'QRIS', 'Debit'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      method === m
                        ? 'bg-[#6B4227] text-[#FAF0DA] border-[#6B4227] shadow-xs'
                        : 'bg-[#FAF0DA]/40 text-[#6B4227] border-[#E5D5BC] hover:bg-[#F2E6CF]'
                    }`}
                  >
                    {m === 'Debit' ? 'Debit / Card' : m}
                  </button>
                ))}
              </div>
            </div>

            {method === 'Cash' ? (
              <div>
                <label className="block text-xs font-semibold text-[#3F2311] mb-1">
                  Amount Received (Rp)
                </label>
                <input
                  key="edit-cash-input"
                  type="number"
                  name="paidAmount"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  min={trxAmount}
                  required
                  className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-sm font-bold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8]"
                />
              </div>
            ) : (
              <div className="p-2.5 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-xs text-[#6B4227]">
                <input key="edit-non-cash-input" type="hidden" name="paidAmount" value={trxAmount} />
                <p className="font-bold text-[#3F2311]">Total: {formatRupiah(trxAmount)}</p>
                <p className="text-[11px] text-[#8E6D53]">Non-cash payment is recorded at the exact order total.</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <SubmitButton
                pendingText="Saving..."
                className="flex-1 py-2 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-xs font-bold hover:bg-[#54311B] transition-all shadow-xs"
              >
                Save Changes
              </SubmitButton>
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="px-3 py-2 bg-[#FAF0DA] text-[#6B4227] hover:bg-[#F2E6CF] border border-[#E5D5BC] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </ActionForm>
        </div>
      )}

      {mode === 'cancel' && (() => {
        const willRevertStock = status === STATUS.PREPARING || status === STATUS.READY;
        return (
          <div className="space-y-3 pt-1">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
              <p className="text-xs font-bold text-red-900">Confirm Order Cancellation</p>
              <p className="text-[11px] text-red-700 leading-relaxed">
                {willRevertStock
                  ? 'Cancelling this order will return its items to stock inventory and deduct the transaction from revenue reports.'
                  : 'Cancelling this order will deduct the transaction from revenue reports. Stock will NOT be returned because the order was already picked up or completed.'}
              </p>
            </div>

            <ActionForm
              action={cancelTransaction}
              confirmMessage={
                willRevertStock
                  ? 'Are you sure you want to cancel this order and restore stock?'
                  : 'Are you sure you want to cancel this order? (Stock will not be restored)'
              }
              reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
              className="space-y-3"
            >
              <input type="hidden" name="transactionId" value={trxId} />
              <div className="flex gap-2">
                <SubmitButton
                  pendingText="Cancelling..."
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 shadow-xs transition-all"
                >
                  {willRevertStock ? 'Confirm & Restore Stock' : 'Confirm Cancellation'}
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setMode('idle')}
                  className="px-3 py-2 bg-[#FAF0DA] text-[#6B4227] hover:bg-[#F2E6CF] border border-[#E5D5BC] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </ActionForm>
          </div>
        );
      })()}
    </div>
  );
}
