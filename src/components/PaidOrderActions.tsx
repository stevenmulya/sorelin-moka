'use client';

import { useState } from 'react';
import { editPaymentMethod, cancelTransaction } from '@/app/actions';
import { Settings2, AlertCircle } from 'lucide-react';

export default function PaidOrderActions({ trxId, trxAmount, currentMethod, currentPaidAmount }: { trxId: number, trxAmount: number, currentMethod: string, currentPaidAmount: number }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm("Update payment details?")) {
      e.preventDefault();
    }
  };

  const handleCancel = (e: React.FormEvent<HTMLFormElement>) => {
    const reason = prompt("Silakan masukkan alasan pembatalan transaksi:");
    if (!reason || reason.trim() === '') {
      e.preventDefault();
      alert("Alasan pembatalan wajib diisi untuk membatalkan pesanan!");
      return;
    }
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = 'cancelReason';
    hiddenInput.value = reason;
    e.currentTarget.appendChild(hiddenInput);
  };

  return (
    <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Transaction Actions
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setIsEditing(!isEditing)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isEditing ? 'bg-gray-200 text-gray-800' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
            Edit Payment
          </button>
          <button onClick={() => setIsCanceling(!isCanceling)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isCanceling ? 'bg-red-200 text-red-900' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'}`}>
            Cancel Order
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-5 bg-white rounded-xl shadow-sm border border-blue-100">
          <h4 className="font-medium text-blue-900 mb-3 text-sm">Update Payment Information</h4>
          <form action={editPaymentMethod} onSubmit={handleEdit} className="flex flex-col sm:flex-row items-end gap-4">
            <input type="hidden" name="transactionId" value={trxId} />
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Payment Method</label>
              <select name="paymentMethod" defaultValue={currentMethod || 'Cash'} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none">
                <option value="Cash">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="Debit">Debit/Credit</option>
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Amount Paid (Rp)</label>
              <input type="number" name="paidAmount" defaultValue={currentPaidAmount || trxAmount} min={trxAmount} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none" />
            </div>
            <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm transition-all">Save Changes</button>
          </form>
        </div>
      )}

      {isCanceling && (
        <div className="p-5 bg-red-50 rounded-xl border border-red-100">
          <h4 className="font-medium text-red-900 flex items-center gap-2 mb-2 text-sm">
            <AlertCircle className="h-4 w-4" /> Danger Zone
          </h4>
          <p className="text-xs text-red-700 mb-4">Canceling a paid order will mark it as cancelled, revert stock deductions, and remove it from revenue reports. This action cannot be undone.</p>
          <form action={cancelTransaction} onSubmit={handleCancel} className="flex justify-end">
            <input type="hidden" name="transactionId" value={trxId} />
            <button type="submit" className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 shadow-sm transition-all">
              Proceed & Revert Stock
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
