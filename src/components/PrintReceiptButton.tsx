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

  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);

  const handlePrint = () => {
    const receiptEl = document.getElementById('printable-receipt');
    if (!receiptEl) {
      window.print();
      return;
    }

    // Isolated hidden iframe ensures pure 48mm thermal output without page layout waste
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '48mm';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Receipt - ${trxCode}</title>
          <style>
            @page {
              size: 58mm auto;
              margin: 0mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 48mm;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #000000;
              font-family: "Courier New", Courier, monospace;
            }
            .thermal-print-wrapper {
              width: 48mm;
              max-width: 48mm;
              margin: 0 auto;
              padding: 2mm 1.5mm;
              background-color: #ffffff;
              color: #000000;
            }
            .thermal-print-wrapper * {
              color: #000000 !important;
              border-color: #000000 !important;
              background-color: transparent !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
            .thermal-print-wrapper table {
              width: 100%;
              border-collapse: collapse;
            }
            .thermal-print-wrapper img {
              filter: grayscale(100%) contrast(500%) brightness(100%) !important;
              image-rendering: pixelated !important;
            }
          </style>
        </head>
        <body>
          <div class="thermal-print-wrapper">
            ${receiptEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 1500);
      }
    }, 250);
  };

  useEffect(() => {
    if (autoPrint) {
      // Clean up URL to remove ?print=true so it doesn't open on reload
      router.replace(pathname || `/transactions/${trx.id}`);
      const timer = setTimeout(() => {
        handlePrint();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, router, pathname, trx.id]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl font-semibold text-sm hover:bg-[#54311B] transition-colors shadow-xs cursor-pointer"
      >
        <Printer className="h-4 w-4" /> Print Receipt
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3F2311]/60 backdrop-blur-xs p-4">
          <div className="bg-[#FFFDF8] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[92vh] border border-[#E5D5BC]">
            {/* Header Modal */}
            <div className="p-4 border-b border-[#E5D5BC] flex items-center justify-between bg-[#FAF0DA]/60">
              <div className="flex items-center gap-2.5">
                <Printer className="h-4 w-4 text-[#C88A32]" />
                <div>
                  <h3 className="font-bold text-[#3F2311] text-xs">Blueprint Lite 58 Receipt Preview</h3>
                  <p className="text-[10px] text-[#8E6D53]">Area Cetak 48mm • 1-Bit Hitam Putih Murni</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-[#8E6D53] hover:text-[#3F2311] p-1.5 rounded-lg transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Scrollable Receipt Area */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-[#FAF0DA]/40 flex flex-col items-center min-h-0 flex-1">
              {/* Thermal Receipt Paper Mockup (Strict Black & White for 48mm print head) */}
              <div 
                id="printable-receipt" 
                className="bg-white w-[48mm] min-w-[48mm] max-w-[48mm] h-auto shadow-md border border-black p-2.5 text-black text-center flex-shrink-0"
                style={{ 
                  fontFamily: '"Courier New", Courier, monospace',
                  fontSize: '10px',
                  lineHeight: '1.25',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              >
                {/* Store Branding */}
                <div className="font-black text-sm tracking-wider mb-0.5 text-black">SORELIN BAKERY</div>
                <div className="text-[9px] font-bold tracking-wide mb-2 text-black">
                  ARTISANAL BAKERY & POS
                </div>
                <div className="border-b border-dashed border-black mb-2"></div>

                {/* Customer Photo (Strict Monochrome 1-Bit Thermal Simulation) */}
                {trx.selfieUrl && (
                  <div className="mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={trx.selfieUrl} 
                      alt="Customer Selfie" 
                      className="w-full h-auto object-cover border border-black"
                      style={{
                        filter: 'grayscale(100%) contrast(400%) brightness(105%)',
                        imageRendering: 'pixelated',
                      }}
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="text-left text-[9.5px] space-y-0.5 mb-2 text-black font-bold">
                  <div>DATE: {formatWibDateTime(trx.createdAt)}</div>
                  <div>TRX: {trxCode}</div>
                  <div>CUST: {trx.customer || 'GUEST'}</div>
                  {trx.cashierName && <div>CASHIER: {trx.cashierName}</div>}
                </div>

                <div className="border-b border-dashed border-black mb-2"></div>

                {/* Items Table */}
                <table className="w-full text-left text-[10px] mb-2 text-black font-bold">
                  <tbody>
                    {trx.items.map((item) => (
                      <tr key={item.id} className="border-b border-dashed border-black last:border-none">
                        <td className="align-top py-1 pr-1 font-bold">
                          <div>{item.productName}</div>
                          <div className="text-[8.5px] font-normal">
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
                <div className="space-y-1 text-black font-bold">
                  <div className="flex justify-between items-center text-[11px] font-black">
                    <span>TOTAL:</span>
                    <span>{formatRupiah(trx.amount)}</span>
                  </div>
                  
                  {trx.paidAmount ? (
                    <>
                      <div className="flex justify-between items-center text-[9.5px] pt-1">
                        <span>{trx.paymentMethod ? trx.paymentMethod.toUpperCase() : 'PAID'}:</span>
                        <span>{formatRupiah(trx.paidAmount)}</span>
                      </div>
                      {(!trx.paymentMethod || trx.paymentMethod.toLowerCase() === 'cash' || (trx.paidAmount - trx.amount) > 0) && (
                        <div className="flex justify-between items-center text-[9.5px]">
                          <span>CHANGE:</span>
                          <span>{formatRupiah(Math.max(0, trx.paidAmount - trx.amount))}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-right text-[9.5px] font-black">
                      STATUS: WAITING FOR PAYMENT
                    </div>
                  )}
                </div>

                {/* Footer Message */}
                <div className="mt-3 pt-2 border-t border-dashed border-black text-[9px] text-center font-bold leading-tight text-black">
                  Thank you for your visit!<br />
                  Follow Instagram: @sorelin.id
                </div>
              </div>

              {/* Blueprint Printer Guidance Tip */}
              <div className="mt-3 px-3 py-2 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-[10px] text-[#6B4227] leading-tight text-center w-full max-w-[240px]">
                <span className="font-bold">Tips Blueprint Lite 58:</span><br />
                Di print dialog browser, set <b>Margin: None</b> & uncheck <b>Header & Footer</b>.
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
