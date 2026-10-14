'use client';

import { useState } from 'react';
import { approvePayment, cancelTransaction } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { CreditCard, Ban } from 'lucide-react';

export default function ConfirmPaymentForm({ 
  trxId, 
  trxAmount, 
  defaultCashier 
}: { 
  trxId: number; 
  trxAmount: number; 
  defaultCashier: string; 
}) {
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Debit'>('Cash');
  const [paidAmount, setPaidAmount] = useState<string>(String(trxAmount));

  const numericPaid = Number(paidAmount) || 0;
  const change = Math.max(0, numericPaid - trxAmount);

  // Common quick amounts for cash
  const quickAmounts = Array.from(
    new Set([
      trxAmount,
      50000 >= trxAmount ? 50000 : null,
      100000 >= trxAmount ? 100000 : null,
      Math.ceil(trxAmount / 50000) * 50000,
      Math.ceil(trxAmount / 100000) * 100000,
    ].filter((v): v is number => v !== null && v >= trxAmount))
  ).slice(0, 3);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
        <CreditCard className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Confirm Payment</h3>
      </div>

      <ActionForm 
        action={approvePayment} 
        confirmMessage="Confirm payment for this order?"
        className="space-y-4"
      >
        <input type="hidden" name="transactionId" value={trxId} />
        <input type="hidden" name="paymentMethod" value={paymentMethod} />

        {/* Cashier Name */}
        <div>
          <label htmlFor="cashierName" className="block text-xs font-semibold text-gray-700 mb-1">
            Cashier Name
          </label>
          <input
            type="text"
            id="cashierName"
            name="cashierName"
            defaultValue={defaultCashier}
            placeholder="Enter cashier name"
            required
            maxLength={60}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Cash', 'QRIS', 'Debit'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`py-2 text-xs font-semibold rounded-lg border transition-all ${
                  paymentMethod === m
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {m === 'Debit' ? 'Debit/Card' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Paid */}
        {paymentMethod === 'Cash' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="paidAmount" className="text-xs font-semibold text-gray-700">
                Amount Received (Rp)
              </label>
              <span className="text-[11px] text-gray-500">
                Min. Rp {trxAmount.toLocaleString('id-ID')}
              </span>
            </div>

            <input
              key="cash-paid-input"
              type="number"
              id="paidAmount"
              name="paidAmount"
              min={trxAmount}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all"
            />

            {/* Quick cash buttons */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPaidAmount(String(amt))}
                  className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold transition-colors"
                >
                  {amt === trxAmount ? 'Exact Cash' : `Rp ${amt.toLocaleString('id-ID')}`}
                </button>
              ))}
            </div>

            {/* Change Due Display */}
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between mt-2">
              <span className="text-xs font-medium text-emerald-800">Change Due</span>
              <span className="text-base font-extrabold text-emerald-700">
                Rp {change.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 space-y-1">
            <input key="non-cash-paid-input" type="hidden" name="paidAmount" value={trxAmount} />
            <p className="font-semibold text-gray-900">Total Due: Rp {trxAmount.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-gray-500">Non-cash payment verified exact to transaction total.</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2">
          <SubmitButton
            pendingText="Processing..."
            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm"
          >
            Confirm Payment
          </SubmitButton>
        </div>
      </ActionForm>

      {/* Cancel Order */}
      <div className="pt-3 border-t border-gray-100">
        <ActionForm 
          action={cancelTransaction} 
          confirmMessage="Are you sure you want to cancel this order?"
          reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
        >
          <input type="hidden" name="transactionId" value={trxId} />
          <SubmitButton 
            pendingText="Cancelling..."
            className="w-full py-2 bg-transparent hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Ban className="h-3.5 w-3.5" /> Cancel This Order
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
