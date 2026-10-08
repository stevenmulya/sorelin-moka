import { PrismaClient } from '@prisma/client';
import { ArrowLeft, CreditCard, Camera } from 'lucide-react';
import Link from 'next/link';
import { approvePayment, cancelTransaction } from '@/app/actions';
import { notFound } from 'next/navigation';
import { generateTrxCode } from '@/lib/utils';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export const instant = false;

export default async function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const transactionId = Number(resolvedParams.id);
  
  if (isNaN(transactionId)) notFound();

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true }
  });

  if (!trx) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
            Transaction {generateTrxCode(trx.id, trx.createdAt, trx.customer)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{trx.createdAt.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Order Items Table at the top */}
        {trx.items && trx.items.length > 0 ? (
          <div className="border-b border-gray-200">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Item Name</th>
                  <th className="px-6 py-3 text-right">Price</th>
                  <th className="px-6 py-3 text-right">Qty</th>
                  <th className="px-6 py-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trx.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{item.productName}</td>
                    <td className="px-6 py-3 text-right text-gray-600">Rp {item.price.toLocaleString('id-ID')}</td>
                    <td className="px-6 py-3 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-gray-500 border-b border-gray-200">No items found.</div>
        )}

        {/* Customer & Total Details at the bottom */}
        <div className="p-6 border-b border-gray-200 bg-gray-50/30">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500">Customer</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{trx.customer}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Amount</p>
              <p className="text-lg font-bold text-gray-900 mt-1">Rp {trx.amount.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mt-1 ${
                trx.status === 'Waiting Payment' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                trx.status === 'Preparing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                trx.status === 'Ready for Pickup' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                trx.status === 'Picked Up' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                trx.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-gray-50 text-gray-700 border-gray-200'
              }`}>
                {trx.status}
              </span>
            </div>
            {trx.cashierName && (
              <div>
                <p className="text-sm font-medium text-gray-500">Cashier</p>
                <p className="text-base text-gray-900 mt-1">{trx.cashierName}</p>
              </div>
            )}
            {trx.paidAmount && (
              <div className="col-span-2 sm:col-span-1">
                <p className="text-sm font-medium text-gray-500">Paid Amount</p>
                <p className="text-base font-semibold text-emerald-600 mt-1">Rp {trx.paidAmount.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Change: Rp {(trx.paidAmount - trx.amount).toLocaleString('id-ID')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Process Form */}
        {trx.status === 'Waiting Payment' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-400" /> Process Payment
            </h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <form action={approvePayment} className="flex-1 space-y-4">
                <input type="hidden" name="transactionId" value={trx.id} />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="cashierName" className="block text-sm font-medium text-gray-700 mb-1">
                      Cashier Name
                    </label>
                    <input
                      type="text"
                      id="cashierName"
                      name="cashierName"
                      placeholder="Cashier Name"
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="paidAmount" className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Paid (Rp)
                    </label>
                    <input
                      type="number"
                      id="paidAmount"
                      name="paidAmount"
                      min={trx.amount}
                      placeholder={`Min. Rp ${trx.amount}`}
                      required
                      className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      name="printType"
                      value="none"
                      className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
                    >
                      Confirm (No Print)
                    </button>
                    <button
                      type="submit"
                      name="printType"
                      value="text"
                      className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      Confirm & Print Receipt
                    </button>
                    <button
                      type="submit"
                      name="printType"
                      value="image"
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Camera className="h-4 w-4" /> Print + Selfie
                    </button>
                  </div>
                  <button
                    formAction={cancelTransaction}
                    className="w-full px-6 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 transition-colors mt-2"
                  >
                    Cancel Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Re-Print Options */}
        {trx.status !== 'Waiting Payment' && trx.status !== 'Cancelled' && (
          <div className="p-6 border-t border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Re-print Receipt</h2>
            <div className="flex gap-3">
              <Link
                href={`/transactions/${trx.id}/print?type=text`}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors text-center"
              >
                Print Receipt
              </Link>
              <Link
                href={`/transactions/${trx.id}/print?type=image`}
                className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="h-4 w-4" /> Print + Selfie
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
