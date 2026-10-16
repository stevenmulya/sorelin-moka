import { prisma } from '@/lib/prisma';
import { ArrowLeft, User, ShoppingBag, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import { formatWibDateTime } from '@/lib/dates';
import { getActiveShift } from '@/lib/services/shifts';
import PrintReceiptButton from '@/components/PrintReceiptButton';
import ConfirmPaymentForm from '@/components/ConfirmPaymentForm';
import PaidOrderActions from '@/components/PaidOrderActions';
import StatusBadge from '@/components/StatusBadge';
import { STATUS } from '@/lib/constants';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
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

  const [trx, activeShift] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { items: true },
    }),
    getActiveShift(),
  ]);

  if (!trx) notFound();

  const totalItems = trx.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);
  const changeDue = Math.max(0, (trx.paidAmount || trx.amount) - trx.amount);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/transactions"
            className="p-2 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl hover:bg-[#FAF0DA] transition-colors shadow-xs text-[#6B4227] cursor-pointer"
            title="Back to Order History"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#6B4227] tracking-tight">Order {trxCode}</h1>
              <StatusBadge status={trx.status} />
            </div>
            <p className="text-xs text-[#8E6D53] mt-0.5">{formatWibDateTime(trx.createdAt)} WIB</p>
          </div>
        </div>

        {trx.status !== STATUS.WAITING && trx.status !== STATUS.CANCELLED && (
          <div className="flex items-center gap-2">
            <PrintReceiptButton trx={trx} autoPrint={autoPrint} />
          </div>
        )}
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Order Items & Payment Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#E5D5BC] flex items-center justify-between bg-[#FAF0DA]/60">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#8E6D53]" />
                <h2 className="font-bold text-[#6B4227] text-sm">Order Items</h2>
              </div>
              <span className="text-xs text-[#8E6D53] font-semibold">{totalItems} items</span>
            </div>

            {trx.items && trx.items.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-[#FAF0DA] text-[#8E6D53] text-xs font-semibold border-b border-[#E5D5BC]">
                  <tr>
                    <th className="px-5 py-3.5">Item Name</th>
                    <th className="px-4 py-3.5 text-right">Price</th>
                    <th className="px-4 py-3.5 text-center">Qty</th>
                    <th className="px-5 py-3.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5D5BC]/60">
                  {trx.items.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF0DA]/60 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-[#3F2311]">{item.productName}</td>
                      <td className="px-4 py-3.5 text-right text-[#8E6D53]">{formatRupiah(item.price)}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-[#6B4227]">{item.quantity}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-[#6B4227]">
                        {formatRupiah(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-[#8E6D53]">No items found in this order.</div>
            )}

            {/* Total & Payment Summary */}
            <div className="p-5 bg-[#FAF0DA]/60 border-t border-[#E5D5BC] space-y-2.5">
              <div className="flex justify-between items-center text-base font-bold text-[#6B4227]">
                <span>Total Amount</span>
                <span>{formatRupiah(trx.amount)}</span>
              </div>

              {trx.paidAmount && trx.status !== STATUS.CANCELLED && (
                <div className="pt-2 border-t border-[#E5D5BC] space-y-1.5 text-xs text-[#5C3A21]">
                  <div className="flex justify-between items-center">
                    <span>Payment Method</span>
                    <span className="font-semibold text-[#6B4227]">{trx.paymentMethod || 'Cash'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Amount Received</span>
                    <span className="font-semibold text-[#6B4227]">{formatRupiah(trx.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-800 font-semibold">
                    <span>Change Due</span>
                    <span>{formatRupiah(changeDue)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancelled Banner */}
          {trx.status === STATUS.CANCELLED && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-red-900 text-sm">This Order Has Been Cancelled</p>
                <p className="text-xs text-red-800 mt-0.5">
                  Reason: <span className="font-semibold">{trx.cancelReason || 'No reason provided'}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer Info & Actions */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-[#FFFDF8] border border-[#E5D5BC] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E5D5BC] pb-3">
              <User className="h-4 w-4 text-[#8E6D53]" />
              <h2 className="font-bold text-[#6B4227] text-sm">Customer Information</h2>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#8E6D53]">Customer Name</p>
                <p className="font-bold text-[#6B4227] text-sm mt-0.5">{trx.customer}</p>
              </div>

              {(trx.customerPhone || trx.customerEmail) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#E5D5BC]/60 text-xs">
                  {trx.customerPhone && (
                    <div>
                      <p className="text-[#8E6D53]">Phone</p>
                      <p className="font-semibold text-[#3F2311] mt-0.5 break-all">{trx.customerPhone}</p>
                    </div>
                  )}
                  {trx.customerEmail && (
                    <div>
                      <p className="text-[#8E6D53]">Email</p>
                      <p className="font-semibold text-[#3F2311] mt-0.5 break-all">{trx.customerEmail}</p>
                    </div>
                  )}
                </div>
              )}

              {trx.selfieUrl && (
                <div>
                  <p className="text-xs text-[#8E6D53] mb-1.5">Kiosk Selfie Photo</p>
                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-[#E5D5BC] bg-[#FAF0DA]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={trx.selfieUrl} alt="Customer Selfie" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[#E5D5BC] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[#8E6D53]">Cashier</p>
                  <p className="font-semibold text-[#3F2311] mt-0.5">
                    {trx.cashierName || activeShift?.openedBy || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-[#8E6D53]">Shift</p>
                  <p className="font-semibold text-[#3F2311] mt-0.5">{trx.shiftId ? `#${trx.shiftId}` : '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Card: Payment or Edit */}
          {trx.status === STATUS.WAITING ? (
            <ConfirmPaymentForm
              trxId={trx.id}
              trxAmount={trx.amount}
              defaultCashier={activeShift?.openedBy || ''}
            />
          ) : trx.status !== STATUS.CANCELLED ? (
            <PaidOrderActions
              trxId={trx.id}
              trxAmount={trx.amount}
              currentMethod={trx.paymentMethod || 'Cash'}
              currentPaidAmount={trx.paidAmount || trx.amount}
              status={trx.status}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
