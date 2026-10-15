'use client';

import { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { generateTrxCode, formatRupiah } from '@/lib/utils';
import { formatWibDateTime } from '@/lib/dates';
import { useRouter, usePathname } from 'next/navigation';

export interface PrintReceiptItem {
  id: number;
  productName: string;
  quantity: number;
  price: number;
}

export interface PrintReceiptTrx {
  id: number;
  createdAt: Date | string;
  customer?: string | null;
  cashierName?: string | null;
  selfieUrl?: string | null;
  amount: number;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  items: PrintReceiptItem[];
}

export default function PrintReceiptButton({ trx, autoPrint }: { trx: PrintReceiptTrx; autoPrint?: boolean }) {
  const [isOpen, setIsOpen] = useState(Boolean(autoPrint));
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (autoPrint) {
      // Clean up URL to remove ?print=true so it doesn't open on reload
      router.replace(pathname || `/transactions/${trx.id}`);
    }
  }, [autoPrint, router, pathname, trx.id]);

  const handlePrint = () => {
    window.print();
  };

  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl font-semibold text-sm hover:bg-[#3D2413] transition-colors shadow-xs cursor-pointer"
      >
        <Printer className="h-4 w-4" /> Print Receipt
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#28170D]/60 backdrop-blur-xs p-4">
          <div className="bg-[#FFFDF9] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[92vh] border border-[#EADBCC]">
            {/* Header Modal */}
            <div className="p-4 border-b border-[#EADBCC] flex items-center justify-between bg-[#FAF7F2]">
              <div className="flex items-center gap-2.5">
                <Printer className="h-4 w-4 text-[#C69234]" />
                <div>
                  <h3 className="font-bold text-[#4A2E1B] text-xs">Blueprint 58mm Thermal Preview</h3>
                  <p className="text-[10px] text-[#7A6251]">1-Bit Monochrome (Black & White)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-[#A89687] hover:text-[#4A2E1B] p-1.5 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Scrollable Receipt Area */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-[#FAF7F2] flex justify-center items-start min-h-0 flex-1">
              {/* Thermal Receipt Paper Mockup (Strict Black & White) */}
              <div 
                id="printable-receipt" 
                className="bg-white w-[58mm] min-h-[100mm] h-max shadow-md border border-black p-3.5 text-black text-center flex-shrink-0"
                style={{ 
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '11px',
                  lineHeight: '1.25',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* Store Branding */}
                <div className="font-black text-base tracking-wider mb-0.5 text-black">SORELIN MOKA</div>
                <div className="text-[10px] font-medium tracking-wide mb-2 text-black">
                  BAZAAR & EVENT POS
                </div>
                <div className="border-b border-dashed border-black mb-2"></div>

                {/* Customer Photo (Strict Monochrome 1-Bit Thermal Simulation) */}
                {trx.selfieUrl && (
                  <div className="mb-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={trx.selfieUrl} 
                      alt="Customer Selfie" 
                      className="w-full h-auto object-cover border-2 border-black"
                      style={{
                        filter: 'grayscale(100%) contrast(220%) brightness(102%)',
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="text-left text-[10px] space-y-0.5 mb-2 text-black font-medium">
                  <div>DATE: {formatWibDateTime(trx.createdAt)}</div>
                  <div>TRX: {trxCode}</div>
                  <div>CUST: {trx.customer || 'GUEST'}</div>
                  {trx.cashierName && <div>CASHIER: {trx.cashierName}</div>}
                </div>

                <div className="border-b border-dashed border-black mb-2"></div>

                {/* Items Table */}
                <table className="w-full text-left text-[10.5px] mb-2 text-black font-medium">
                  <tbody>
                    {trx.items.map((item) => (
                      <tr key={item.id} className="border-b border-dotted border-black/30 last:border-none">
                        <td className="align-top py-1">
                          <div className="font-bold">{item.productName}</div>
                          <div className="text-[9.5px]">
                            {item.quantity} x {formatRupiah(item.price)}
                          </div>
                        </td>
                        <td className="align-bottom text-right py-1 font-bold whitespace-nowrap">
                          {formatRupiah(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-b border-dashed border-black mb-2"></div>

                {/* Totals & Payments */}
                <div className="space-y-1 text-black">
                  <div className="flex justify-between items-center text-xs font-black">
                    <span>TOTAL:</span>
                    <span>{formatRupiah(trx.amount)}</span>
                  </div>
                  
                  {trx.paidAmount ? (
                    <>
                      <div className="flex justify-between items-center text-[10px] font-medium pt-1">
                        <span>{trx.paymentMethod ? trx.paymentMethod.toUpperCase() : 'PAID'}:</span>
                        <span>{formatRupiah(trx.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-medium">
                        <span>CHANGE:</span>
                        <span>{formatRupiah(trx.paidAmount - trx.amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-right text-[10px] font-bold">
                      STATUS: WAITING FOR PAYMENT
                    </div>
                  )}
                </div>

                {/* Footer Message */}
                <div className="mt-4 pt-2 border-t border-dashed border-black text-[9.5px] text-center font-medium leading-tight text-black">
                  Thank you for your visit!<br />
                  Follow Instagram: @sorelin.id
                </div>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="p-3.5 border-t border-[#EADBCC] bg-[#FFFDF9] flex gap-2">
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-1/3 py-2.5 bg-[#FAF7F2] border border-[#EADBCC] text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#EADBCC]/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
              <button 
                type="button"
                onClick={handlePrint}
                className="w-2/3 py-2.5 bg-[#4A2E1B] text-[#FFFDF9] rounded-xl text-xs font-bold hover:bg-[#3D2413] transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print with Blueprint
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
