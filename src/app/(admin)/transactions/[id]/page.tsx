import { prisma } from '@/lib/prisma';
import { ArrowLeft, User, ShoppingBag, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import PrintReceiptButton from '@/components/PrintReceiptButton';
import ConfirmPaymentForm from '@/components/ConfirmPaymentForm';
import PaidOrderActions from '@/components/PaidOrderActions';
import StatusBadge from '@/components/StatusBadge';

export const instant = false;

export default async function TransactionDetail(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;
  const transactionId = Number(resolvedParams.id);
  const autoPrint = resolvedSearchParams.print === 'true';

  if (isNaN(transactionId)) notFound();

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true },
  });

  if (!trx) notFound();

  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' },
  });

  const totalItems = trx.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);
  const changeDue = Math.max(0, (trx.paidAmount || trx.amount) - trx.amount);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/transactions"
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-gray-600"
            title="Back to Transactions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Order {trxCode}
              </h1>
              <StatusBadge status={trx.status} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(trx.createdAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>

        {trx.status !== 'Waiting Payment' && trx.status !== 'Cancelled' && (
          <div className="flex items-center gap-2">
            <PrintReceiptButton trx={trx} autoPrint={autoPrint} />
          </div>
        )}
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order Items & Payment Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-gray-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Order Items</h2>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {totalItems} items
              </span>
            </div>

            {trx.items && trx.items.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/80 text-gray-500 text-xs font-semibold border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3">Item Name</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-5 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trx.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3.5 text-right text-gray-500">
                        {formatRupiah(item.price)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-gray-700">
                        {item.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                        {formatRupiah(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">
                No items found in this order.
              </div>
            )}

            {/* Total & Payment Summary */}
            <div className="p-5 bg-gray-50/60 border-t border-gray-100 space-y-2.5">
              <div className="flex justify-between items-center text-base font-bold text-gray-900">
                <span>Total Amount</span>
                <span>{formatRupiah(trx.amount)}</span>
              </div>

              {trx.paidAmount && trx.status !== 'Cancelled' && (
                <div className="pt-2 border-t border-gray-200/60 space-y-1.5 text-xs text-gray-600">
                  <div className="flex justify-between items-center">
                    <span>Payment Method</span>
                    <span className="font-semibold text-gray-900">{trx.paymentMethod || 'Cash'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Amount Received</span>
                    <span className="font-semibold text-gray-900">{formatRupiah(trx.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-semibold">
                    <span>Change Due</span>
                    <span>{formatRupiah(changeDue)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancelled Banner */}
          {trx.status === 'Cancelled' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900 text-sm">This Order Has Been Cancelled</p>
                <p className="text-xs text-red-700 mt-0.5">
                  Reason: <span className="font-semibold">{trx.cancelReason || 'No reason provided'}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer Info & Actions */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <User className="h-4 w-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Customer Information</h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500">Customer Name</p>
                <p className="font-semibold text-gray-900 text-sm mt-0.5">{trx.customer}</p>
              </div>

              {trx.selfieUrl && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Kiosk Selfie Photo</p>
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={trx.selfieUrl} 
                      alt="Customer Selfie" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Cashier</p>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {trx.cashierName || activeShift?.openedBy || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Shift</p>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {trx.shiftId ? `#${trx.shiftId}` : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Card: Payment or Edit */}
          {trx.status === 'Waiting Payment' ? (
            <ConfirmPaymentForm 
              trxId={trx.id} 
              trxAmount={trx.amount} 
              defaultCashier={activeShift?.openedBy || ''} 
            />
          ) : trx.status !== 'Cancelled' ? (
            <PaidOrderActions 
              trxId={trx.id}
              trxAmount={trx.amount}
              currentMethod={trx.paymentMethod || 'Cash'}
              currentPaidAmount={trx.paidAmount || trx.amount}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
