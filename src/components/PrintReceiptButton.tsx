'use client';

import { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { generateTrxCode } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';

export default function PrintReceiptButton({ trx, autoPrint }: { trx: any, autoPrint?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (autoPrint) {
      setIsOpen(true);
      // Clean up URL to remove ?print=true so it doesn't open on reload
      router.replace(pathname || `/transactions/${trx.id}`);
    }
  }, [autoPrint, router, pathname, trx.id]);

  const handlePrint = () => {
    window.print();
  };

  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);
  const totalItems = trx.items.reduce((acc: number, item: any) => acc + item.quantity, 0);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors"
      >
        <Printer className="h-4 w-4" /> Print Receipt
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Printer className="h-4 w-4 text-gray-500" /> Receipt Preview
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Scrollable Receipt Area */}
            <div className="p-6 overflow-y-auto bg-gray-200 flex justify-center items-start min-h-0 flex-1">
              {/* Thermal Receipt Paper Mockup */}
              <div 
                id="printable-receipt" 
                className="bg-white w-[58mm] min-h-[100mm] h-max shadow-sm p-4 text-black text-center flex-shrink-0"
                style={{ 
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '12px',
                  lineHeight: '1.2'
                }}
              >
                <div className="font-bold text-lg mb-1">SORELIN MOKA</div>
                <div className="text-[10px] mb-3 border-b border-dashed border-black pb-2">
                  Bazaar & Event POS
                </div>

                {trx.selfieUrl && (
                  <div className="mb-3">
                    <img 
                      src={trx.selfieUrl} 
                      alt="Customer Selfie" 
                      className="w-full h-auto object-cover border border-black filter grayscale"
                    />
                  </div>
                )}

                <div className="text-left text-[11px] mb-3">
                  <div>Date: {new Date(trx.createdAt).toLocaleString('id-ID')}</div>
                  <div>Trx: {trxCode}</div>
                  <div>Cust: {trx.customer}</div>
                  {trx.cashierName && <div>Cashier: {trx.cashierName}</div>}
                </div>

                <div className="border-b border-dashed border-black mb-2"></div>

                <table className="w-full text-left text-[11px] mb-2">
                  <tbody>
                    {trx.items.map((item: any) => (
                      <tr key={item.id}>
                        <td className="align-top py-1">
                          <div>{item.productName}</div>
                          <div className="text-[10px]">
                            {item.quantity} x {item.price.toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td className="align-bottom text-right py-1">
                          {(item.price * item.quantity).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-b border-dashed border-black mb-2"></div>

                <div className="text-right text-[11px] font-bold mb-1">
                  TOTAL: Rp {trx.amount.toLocaleString('id-ID')}
                </div>
                
                {trx.paidAmount ? (
                  <>
                    <div className="text-right text-[11px]">
                      {trx.paymentMethod || 'PAYMENT'}: Rp {trx.paidAmount.toLocaleString('id-ID')}
                    </div>
                    <div className="text-right text-[11px]">
                      CHANGE: Rp {(trx.paidAmount - trx.amount).toLocaleString('id-ID')}
                    </div>
                  </>
                ) : (
                  <div className="text-right text-[11px]">
                    STATUS: UNPAID
                  </div>
                )}

                <div className="mt-4 pt-2 border-t border-dashed border-black text-[10px]">
                  Thank you for your purchase!<br />
                  Please come again.
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <button 
                onClick={handlePrint}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
