import { PrismaClient } from '@prisma/client';
import { Printer, Camera, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { generateTrxCode } from '@/lib/utils';

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default async function PrintReceiptPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ type?: string }>
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const transactionId = Number(resolvedParams.id);
  const type = resolvedSearch.type || 'text';
  
  if (isNaN(transactionId)) notFound();

  const trx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { items: true }
  });

  if (!trx) notFound();

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/" className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Print Receipt</h1>
          <p className="text-sm text-gray-500 mt-1">Transaction {generateTrxCode(trx.id, trx.createdAt, trx.customer)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-8 max-w-sm mx-auto">
        {/* Receipt Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Sorelin Moka</h2>
          <p className="text-sm text-gray-500 mt-1">Jl. Contoh Alamat No. 123</p>
          <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
          <div className="flex justify-between text-xs text-gray-600">
            <span>{trx.createdAt.toLocaleString()}</span>
            <span>{generateTrxCode(trx.id, trx.createdAt, trx.customer)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Cashier: {trx.cashierName || 'System'}</span>
            <span>Customer: {trx.customer}</span>
          </div>
          <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
        </div>

        {/* Receipt Items */}
        <div className="space-y-3 mb-4 text-sm text-gray-800">
          {trx.items.map(item => (
            <div key={item.id} className="flex justify-between items-start">
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-gray-500">{item.quantity}x @ Rp {item.price.toLocaleString('id-ID')}</p>
              </div>
              <p className="font-medium text-gray-900">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>

        {/* Receipt Total */}
        <div className="border-t-2 border-dashed border-gray-300 pt-4 mb-6">
          <div className="flex justify-between font-bold text-lg text-gray-900">
            <span>TOTAL</span>
            <span>Rp {trx.amount.toLocaleString('id-ID')}</span>
          </div>
          {trx.paidAmount && (
            <>
              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span>CASH</span>
                <span>Rp {trx.paidAmount.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>CHANGE</span>
                <span>Rp {(trx.paidAmount - trx.amount).toLocaleString('id-ID')}</span>
              </div>
            </>
          )}
        </div>

        {/* Selfie Section */}
        {type === 'image' && (
          <div className="mb-6 pt-4 border-t border-gray-200">
            <h3 className="text-center text-sm font-semibold text-gray-900 mb-3 flex items-center justify-center gap-2">
              <Camera className="h-4 w-4" /> Customer Selfie
            </h3>
            
            <div className="aspect-square bg-gray-100 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-300 relative overflow-hidden group">
              {/* This is a placeholder for hardware camera integration */}
              <Camera className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-xs font-medium text-gray-500">Hardware Camera Feed</p>
              <button className="absolute bottom-4 px-4 py-2 bg-blue-600 text-white rounded-full text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2">
                Capture Photo
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-2">Photo will be printed at the bottom of the receipt.</p>
          </div>
        )}

        <div className="text-center text-xs text-gray-500 mt-8">
          <p>Thank you for your visit!</p>
          <p>Please come again.</p>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-8">
        <button className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2">
          <Printer className="h-4 w-4" /> Print Now
        </button>
        <Link href="/" className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
