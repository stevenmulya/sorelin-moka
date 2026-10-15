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
  status
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
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Manage Order</h3>
        </div>
        {mode === 'idle' && (
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
            <Check className="h-3 w-3" /> Paid ({currentMethod || 'Cash'})
          </span>
        )}
      </div>

      {mode === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button 
            type="button"
            onClick={() => setMode('edit')} 
            className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Payment Method
          </button>
          <button 
            type="button"
            onClick={() => setMode('cancel')} 
            className="flex-1 py-2 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <Ban className="h-3.5 w-3.5" /> Cancel Order
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-900">Update Payment Information</p>
            <button
              type="button"
              onClick={() => setMode('idle')}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Close
            </button>
          </div>

          <ActionForm 
            action={editPaymentMethod} 
            confirmMessage="Save payment changes?"
            className="space-y-3"
          >
            <input type="hidden" name="transactionId" value={trxId} />
            <input type="hidden" name="paymentMethod" value={method} />

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Cash', 'QRIS', 'Debit'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      method === m
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {m === 'Debit' ? 'Debit/Card' : m}
                  </button>
                ))}
              </div>
            </div>

            {method === 'Cash' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900" 
                />
              </div>
            ) : (
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                <input key="edit-non-cash-input" type="hidden" name="paidAmount" value={trxAmount} />
                <p className="font-semibold text-gray-900">Total: {formatRupiah(trxAmount)}</p>
                <p className="text-[11px] text-gray-500">Non-cash payment calculated exact to order total.</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <SubmitButton 
                pendingText="Saving..."
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-gray-800 transition-all shadow-sm"
              >
                Save Changes
              </SubmitButton>
              <button
                type="button"
                onClick={() => setMode('idle')}
                className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors"
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
              <p className="text-xs font-bold text-red-900">Confirm Order Cancellation</p>
              <p className="text-[11px] text-red-700">
                {willRevertStock
                  ? 'Cancelling this order will return items to stock inventory and deduct the transaction from revenue reports.'
                  : 'Cancelling this order will deduct the transaction from revenue reports. Stock is NOT returned because items were already picked up/completed.'}
              </p>
            </div>

            <ActionForm 
              action={cancelTransaction} 
              confirmMessage={
                willRevertStock
                  ? 'Are you sure you want to cancel this order and revert stock?'
                  : 'Are you sure you want to cancel this order? (Stock will not be reverted)'
              }
              reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
              className="space-y-3"
            >
              <input type="hidden" name="transactionId" value={trxId} />
              <div className="flex gap-2">
                <SubmitButton 
                  pendingText="Cancelling..."
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 shadow-sm transition-all"
                >
                  {willRevertStock ? 'Proceed & Revert Stock' : 'Proceed & Cancel Order'}
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setMode('idle')}
                  className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-xs font-semibold transition-colors"
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
