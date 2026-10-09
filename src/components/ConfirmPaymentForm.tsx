'use client';

import { approvePayment, cancelTransaction } from '@/app/actions';
import { CreditCard } from 'lucide-react';

export default function ConfirmPaymentForm({ 
  trxId, 
  trxAmount, 
  defaultCashier 
}: { 
  trxId: number, 
  trxAmount: number, 
  defaultCashier: string 
}) {
  
  const handleApprove = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("Are you sure you want to confirm this payment?")) {
      e.preventDefault();
    }
  };

  const handleCancel = (e: React.FormEvent<HTMLFormElement>) => {
    const reason = prompt("Reason for cancellation (required):");
    if (!reason || reason.trim() === '') {
      e.preventDefault();
      alert("Cancellation reason is required.");
      return;
    }

    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'cancelReason';
    hiddenInput.value = reason;
    e.currentTarget.appendChild(hiddenInput);
  };

  return (
    <div className="p-6 bg-white">
      <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-gray-400" /> Confirm Payment
      </h2>
      <div className="flex flex-col gap-5">
        <form action={approvePayment} onSubmit={handleApprove} className="flex-1 space-y-5">
          <input type="hidden" name="transactionId" value={trxId} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="cashierName" className="block text-sm font-medium text-gray-700 mb-1.5">
                Cashier Name
              </label>
              <input
                type="text"
                id="cashierName"
                name="cashierName"
                defaultValue={defaultCashier}
                placeholder="Cashier Name"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1.5">
                Payment Method
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              >
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="Debit">Debit/Credit</option>
              </select>
            </div>

            <div>
              <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1.5">
                Amount Paid (Rp)
              </label>
              <input
                type="number"
                id="paidAmount"
                name="paidAmount"
                min={trxAmount}
                defaultValue={trxAmount}
                placeholder={`Min. Rp ${trxAmount}`}
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-all shadow-sm"
            >
              Confirm Payment
            </button>
          </div>
        </form>

        <form action={cancelTransaction} onSubmit={handleCancel} className="pt-4 border-t border-gray-100 flex justify-end">
          <input type="hidden" name="transactionId" value={trxId} />
          <button type="submit" className="px-6 py-2 bg-white border border-red-200 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 transition-all">
            Cancel Order
          </button>
        </form>
      </div>
    </div>
  );
}
