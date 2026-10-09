import { PrismaClient } from '@prisma/client';
import { ArrowLeft, CreditCard, Camera } from 'lucide-react';
import Link from 'next/link';
import { approvePayment, cancelTransaction, editPaymentMethod } from '@/app/actions';
import { notFound } from 'next/navigation';
import { generateTrxCode } from '@/lib/utils';
import PrintReceiptButton from '@/components/PrintReceiptButton';
import ConfirmPaymentForm from '@/components/ConfirmPaymentForm';
import PaidOrderActions from '@/components/PaidOrderActions';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function TransactionDetail(props: { params: Promise<{ id: string }>, searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;
  const transactionId = Number(resolvedParams.id);
  const autoPrint = resolvedSearchParams.print === 'true';
  
  if (isNaN(transactionId)) notFound();

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true }
  });

  if (!trx) notFound();

  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { startTime: 'desc' }
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              Order {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{trx.createdAt.toLocaleString()}</p>
          </div>
        </div>
        {trx.status !== 'Waiting Payment' && trx.status !== 'Cancelled' && (
          <PrintReceiptButton trx={trx} autoPrint={autoPrint} />
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Order Items Table at the top */}
        {trx.items && trx.items.length > 0 ? (
          <div className="border-b border-gray-100">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Item Name</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-center">Qty</th>
                  <th className="px-6 py-4 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {trx.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-6 py-4 text-right text-gray-500">Rp {item.price.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{item.quantity}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-gray-500 border-b border-gray-100">No items found in this order.</div>
        )}

        {/* Customer & Total Details at the bottom */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <div className="flex items-center gap-3 mt-1">
                {trx.selfieUrl && (
                  <img src={trx.selfieUrl} alt="Selfie" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm" />
                )}
                <p className="text-base font-semibold text-gray-900">{trx.customer}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-base font-semibold text-gray-900 mt-1">Rp {trx.amount.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mt-1.5 ${
                trx.status === 'Waiting Payment' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                trx.status === 'Preparing' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                trx.status === 'Ready for Pickup' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                trx.status === 'Picked Up' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                trx.status === 'Cancelled' ? 'bg-red-100 text-red-800 border-red-200' :
                'bg-gray-100 text-gray-800 border-gray-200'
              }`}>
                {trx.status}
              </span>
            </div>
            {trx.cashierName && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cashier</p>
                <p className="text-base font-semibold text-gray-900 mt-1">{trx.cashierName}</p>
              </div>
            )}
            {trx.paidAmount && (
              <div className="col-span-2 md:col-span-4 bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Paid Amount</p>
                    <p className="text-xl font-black text-emerald-700 mt-0.5">Rp {trx.paidAmount.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="pl-4 border-l border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">Method</p>
                    <p className="text-sm bg-white border border-emerald-200 rounded px-2 py-1 text-emerald-800 font-medium inline-block">
                      {trx.paymentMethod || 'Cash'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Change Due</p>
                  <p className="text-lg font-bold text-emerald-700 mt-0.5">Rp {(trx.paidAmount - trx.amount).toLocaleString('id-ID')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Process Form */}
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
        ) : (
          <div className="p-6 bg-red-50 text-red-700 border-t border-red-100 flex flex-col items-center justify-center">
            <p className="font-semibold">This order was cancelled.</p>
            {trx.cancelReason && <p className="text-sm mt-1">Reason: {trx.cancelReason}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
