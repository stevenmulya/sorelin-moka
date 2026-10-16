'use client';

import { useState } from 'react';
import { approvePayment, cancelTransaction } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { CreditCard, Ban } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

export default function ConfirmPaymentForm({
  trxId,
  trxAmount,
  defaultCashier,
}: {
  trxId: number;
  trxAmount: number;
  defaultCashier: string;
}) {
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QRIS' | 'Debit'>('Cash');
  const [paidAmount, setPaidAmount] = useState<string>(String(trxAmount));

  const numericPaid = Number(paidAmount) || 0;
  const change = Math.max(0, numericPaid - trxAmount);

  // Common quick amounts for cash payment
  const quickAmounts = Array.from(
    new Set(
      [
        trxAmount,
        50000 >= trxAmount ? 50000 : null,
        100000 >= trxAmount ? 100000 : null,
        Math.ceil(trxAmount / 50000) * 50000,
        Math.ceil(trxAmount / 100000) * 100000,
      ].filter((v): v is number => v !== null && v >= trxAmount)
    )
  ).slice(0, 3);

  return (
    <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-5 shadow-xs space-y-5">
      <div className="flex items-center gap-2 border-b border-[#E5D5BC] pb-3">
        <CreditCard className="h-4 w-4 text-[#C88A32]" />
        <h3 className="font-bold text-[#3F2311] text-sm">Confirm Payment</h3>
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
          <label htmlFor="cashierName" className="block text-xs font-semibold text-[#3F2311] mb-1">
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
            className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs font-medium text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] transition-all"
          />
        </div>

        {/* Payment Method Selector */}
        <div>
          <label className="block text-xs font-semibold text-[#3F2311] mb-1.5">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Cash', 'QRIS', 'Debit'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  paymentMethod === m
                    ? 'bg-[#6B4227] text-[#FAF0DA] border-[#6B4227] shadow-xs'
                    : 'bg-[#FAF0DA]/40 text-[#6B4227] border-[#E5D5BC] hover:bg-[#F2E6CF]'
                }`}
              >
                {m === 'Debit' ? 'Debit / Card' : m}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Paid */}
        {paymentMethod === 'Cash' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="paidAmount" className="text-xs font-semibold text-[#3F2311]">
                Amount Received (Rp)
              </label>
              <span className="text-[11px] text-[#8E6D53]">
                Min. {formatRupiah(trxAmount)}
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
              className="w-full px-3 py-2 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-sm font-bold text-[#3F2311] focus:outline-none focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] transition-all"
            />

            {/* Quick cash buttons */}
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setPaidAmount(String(amt))}
                  className="px-2.5 py-1 bg-[#FAF0DA] hover:bg-[#F2E6CF] text-[#6B4227] border border-[#E5D5BC] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {amt === trxAmount ? 'Exact Cash' : formatRupiah(amt)}
                </button>
              ))}
            </div>

            {/* Change Due Display */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between mt-2">
              <span className="text-xs font-medium text-emerald-800">Change Due</span>
              <span className="text-sm font-extrabold text-emerald-700">
                {formatRupiah(change)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#FAF0DA]/50 border border-[#E5D5BC] rounded-xl text-xs text-[#6B4227] space-y-1">
            <input key="non-cash-paid-input" type="hidden" name="paidAmount" value={trxAmount} />
            <p className="font-bold text-[#3F2311]">Total Due: {formatRupiah(trxAmount)}</p>
            <p className="text-[11px] text-[#8E6D53]">Non-cash payment is recorded at the exact order total.</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-1">
          <SubmitButton
            pendingText="Processing..."
            className="w-full py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-bold text-xs hover:bg-[#54311B] transition-all shadow-xs"
          >
            Confirm Payment
          </SubmitButton>
        </div>
      </ActionForm>

      {/* Cancel Order */}
      <div className="pt-3 border-t border-[#E5D5BC]">
        <ActionForm
          action={cancelTransaction}
          confirmMessage="Are you sure you want to cancel this order?"
          reason={{ name: 'cancelReason', message: 'Cancellation reason (required):' }}
        >
          <input type="hidden" name="transactionId" value={trxId} />
          <SubmitButton
            pendingText="Cancelling..."
            className="w-full py-2 bg-transparent hover:bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Ban className="h-3.5 w-3.5" /> Cancel Order
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
