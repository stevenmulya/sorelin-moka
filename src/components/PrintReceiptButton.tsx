'use client';

import { useState, useEffect, useCallback } from 'react';
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

/**
 * Self-contained CSS shared between the on-screen preview and the isolated print iframe.
 * Zero dependency on Tailwind utility classes so the print iframe renders identically
 * on Blueprint Lite 58 (58mm paper roll, 48mm active thermal head).
 */
const RECEIPT_CSS = `
  .bp-receipt {
    width: 48mm;
    min-width: 48mm;
    max-width: 48mm;
    box-sizing: border-box;
    padding: 2mm 1.5mm 3mm 1.5mm;
    background-color: #ffffff !important;
    color: #000000 !important;
    font-family: "Courier New", Courier, monospace;
    font-size: 10px;
    line-height: 1.3;
    font-weight: 700;
    text-align: left;
    word-break: break-word;
    overflow-wrap: anywhere;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .bp-receipt * {
    box-sizing: border-box;
    color: #000000 !important;
    background-color: transparent !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  .bp-center {
    text-align: center;
  }
  .bp-logo-wrap {
    width: 100%;
    text-align: center;
    margin: 0 auto 3px auto;
  }
  .bp-logo-img {
    display: block;
    width: 28mm;
    max-width: 28mm;
    height: auto;
    margin: 0 auto;
    image-rendering: pixelated;
  }
  .bp-logo-raw {
    filter: grayscale(100%) contrast(230%) brightness(115%);
  }
  .bp-store-name {
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.5px;
    text-align: center;
    margin-bottom: 1px;
  }
  .bp-store-sub {
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-align: center;
    margin-bottom: 5px;
  }
  .bp-divider {
    width: 100%;
    border-top: 1px dashed #000000 !important;
    margin: 5px 0;
    height: 0;
  }
  .bp-divider-double {
    width: 100%;
    border-top: 2px solid #000000 !important;
    margin: 5px 0;
    height: 0;
  }
  .bp-selfie-wrap {
    width: 100%;
    margin: 4px 0 6px 0;
    text-align: center;
  }
  .bp-selfie-img {
    display: block;
    width: 100%;
    max-width: 38mm;
    height: auto;
    margin: 0 auto;
    border: 1px solid #000000 !important;
    image-rendering: pixelated;
  }
  .bp-meta {
    font-size: 9px;
    line-height: 1.35;
    margin: 4px 0;
  }
  .bp-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 4px;
    margin-bottom: 1.5px;
  }
  .bp-meta-label {
    flex-shrink: 0;
    font-weight: 700;
  }
  .bp-meta-val {
    text-align: right;
    font-weight: 700;
    word-break: break-all;
  }
  .bp-items {
    width: 100%;
    margin: 4px 0;
  }
  .bp-item {
    margin-bottom: 5px;
  }
  .bp-item:last-child {
    margin-bottom: 1px;
  }
  .bp-item-name {
    font-size: 10px;
    font-weight: 800;
    line-height: 1.25;
    margin-bottom: 1px;
  }
  .bp-item-calc {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9.5px;
    font-weight: 700;
  }
  .bp-totals {
    width: 100%;
    margin: 4px 0;
  }
  .bp-total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9.5px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .bp-total-main {
    font-size: 11px;
    font-weight: 900;
    margin-bottom: 3px;
  }
  .bp-footer {
    margin-top: 6px;
    font-size: 8.5px;
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
  }
`;

/**
 * Convert a continuous-tone customer selfie into a true 1-bit monochrome bitmap
 * using Atkinson dithering so Blueprint Lite 58 thermal printers print crisp dots
 * instead of a solid black threshold block.
 */
function createDitheredDataUrl(src: string, targetWidth = 240): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = targetWidth;
        const h = Math.max(1, Math.round((img.height / img.width) * w));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const lum = new Float32Array(w * h);

        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          // Luminance with slight contrast boost for thermal paper
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          lum[i] = Math.min(255, Math.max(0, (gray - 128) * 1.25 + 135));
        }

        // Atkinson dithering (ideal for 203 DPI thermal printers)
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const oldPixel = lum[i];
            const newPixel = oldPixel < 128 ? 0 : 255;
            lum[i] = newPixel;
            const err = (oldPixel - newPixel) / 8;

            if (x + 1 < w) lum[i + 1] += err;
            if (x + 2 < w) lum[i + 2] += err;
            if (y + 1 < h) {
              if (x - 1 >= 0) lum[(y + 1) * w + (x - 1)] += err;
              lum[(y + 1) * w + x] += err;
              if (x + 1 < w) lum[(y + 1) * w + (x + 1)] += err;
            }
            if (y + 2 < h) {
              lum[(y + 2) * w + x] += err;
            }
          }
        }

        for (let i = 0; i < w * h; i++) {
          const v = lum[i] < 128 ? 0 : 255;
          const idx = i * 4;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
          data[idx + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

/**
 * Convert the Sorelin Secondary Lockup logo (which has a #FAF0DA cream background
 * and #6B4227 brown illustration) into a pure black-on-white 1-bit thermal bitmap
 * so Blueprint Lite 58 prints zero background dots and sharp mascot/text details.
 */
function createThermalLogoDataUrl(src: string, targetWidth = 260): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = targetWidth;
        const h = Math.max(1, Math.round((img.height / img.width) * w));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const lum = new Float32Array(w * h);

        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          // Knock out cream background & light face fill (>= 202) to pure white (255),
          // and map the brown illustration/text to high-contrast dark values.
          if (gray >= 202) {
            lum[i] = 255;
          } else {
            lum[i] = Math.max(0, Math.min(255, ((gray - 85) / (202 - 85)) * 255));
          }
        }

        // Atkinson dithering preserves the hand-drawn crayon texture of the mascot
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const oldPixel = lum[i];
            const newPixel = oldPixel < 140 ? 0 : 255;
            lum[i] = newPixel;
            const err = (oldPixel - newPixel) / 8;

            if (x + 1 < w) lum[i + 1] += err;
            if (x + 2 < w) lum[i + 2] += err;
            if (y + 1 < h) {
              if (x - 1 >= 0) lum[(y + 1) * w + (x - 1)] += err;
              lum[(y + 1) * w + x] += err;
              if (x + 1 < w) lum[(y + 1) * w + (x + 1)] += err;
            }
            if (y + 2 < h) {
              lum[(y + 2) * w + x] += err;
            }
          }
        }

        for (let i = 0; i < w * h; i++) {
          const v = lum[i] < 128 ? 0 : 255;
          const idx = i * 4;
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
          data[idx + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
}

export default function PrintReceiptButton({ trx, autoPrint }: { trx: PrintReceiptTrx; autoPrint?: boolean }) {
  const [isOpen, setIsOpen] = useState(Boolean(autoPrint));
  const [includePhoto, setIncludePhoto] = useState(Boolean(trx.selfieUrl));
  const [ditheredSelfie, setDitheredSelfie] = useState<string | null>(null);
  const [thermalLogo, setThermalLogo] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);
  const totalQty = trx.items.reduce((acc, item) => acc + item.quantity, 0);

  useEffect(() => {
    let active = true;
    createThermalLogoDataUrl('/sorelin-lockup-secondary.png').then((url) => {
      if (active) setThermalLogo(url);
    });
    if (trx.selfieUrl) {
      createDitheredDataUrl(trx.selfieUrl).then((url) => {
        if (active) setDitheredSelfie(url);
      });
    }
    return () => {
      active = false;
    };
  }, [trx.selfieUrl]);

  const handlePrint = useCallback(() => {
    const receiptEl = document.getElementById('printable-receipt');
    if (!receiptEl) {
      window.print();
      return;
    }

    // Isolated hidden iframe with complete self-contained styles for 48mm Blueprint Lite 58
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
              max-width: 48mm;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              color: #000000;
            }
            ${RECEIPT_CSS}
          </style>
        </head>
        <body>
          <div class="bp-receipt">
            ${receiptEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    const triggerPrint = () => {
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
        }, 2000);
      }
    };

    // Wait for all images inside the iframe before invoking the printer spooler
    const imgs = Array.from(frameDoc.images);
    if (imgs.length === 0 || imgs.every((img) => img.complete)) {
      setTimeout(triggerPrint, 150);
    } else {
      let loaded = 0;
      const checkDone = () => {
        loaded += 1;
        if (loaded >= imgs.length) setTimeout(triggerPrint, 100);
      };
      imgs.forEach((img) => {
        if (img.complete) checkDone();
        else {
          img.onload = checkDone;
          img.onerror = checkDone;
        }
      });
    }
  }, [trxCode]);

  useEffect(() => {
    if (autoPrint) {
      // Clean up URL to remove ?print=true so it doesn't re-trigger on reload
      router.replace(pathname || `/transactions/${trx.id}`);
      const timer = setTimeout(() => {
        handlePrint();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, router, pathname, trx.id, handlePrint]);

  const photoSrc = ditheredSelfie || trx.selfieUrl;
  const logoSrc = thermalLogo || '/sorelin-lockup-secondary.png';

  return (
    <>
      <style>{RECEIPT_CSS}</style>
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
                  <p className="text-[10px] text-[#8E6D53]">Kertas 58mm • Area Cetak 48mm (1-Bit Thermal)</p>
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
              {trx.selfieUrl && (
                <label className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFFDF8] border border-[#E5D5BC] rounded-xl text-xs font-semibold text-[#3F2311] cursor-pointer select-none shadow-2xs">
                  <input
                    type="checkbox"
                    checked={includePhoto}
                    onChange={(e) => setIncludePhoto(e.target.checked)}
                    className="rounded border-[#6B4227] text-[#6B4227] focus:ring-[#6B4227]"
                  />
                  <span>Sertakan Foto Pelanggan di Struk</span>
                </label>
              )}

              {/* Thermal Receipt Paper Mockup (Strict Black & White for 48mm print head) */}
              <div
                id="printable-receipt"
                className="bp-receipt shadow-md border border-black flex-shrink-0"
              >
                {/* Store Branding (Sorelin Secondary Lockup + Subtitle) */}
                <div className="bp-logo-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt="Sorelin Bakery"
                    className={`bp-logo-img${thermalLogo ? '' : ' bp-logo-raw'}`}
                  />
                </div>
                <div className="bp-store-sub">FRESHLY BAKED SALTBREAD</div>
                <div className="bp-divider" />

                {/* Customer Photo (1-Bit Atkinson Dithered for Thermal Print Head) */}
                {trx.selfieUrl && includePhoto && photoSrc && (
                  <div className="bp-selfie-wrap">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoSrc}
                      alt="Customer Selfie"
                      className="bp-selfie-img"
                    />
                  </div>
                )}

                {/* Metadata */}
                <div className="bp-meta">
                  <div className="bp-meta-row">
                    <span className="bp-meta-label">DATE:</span>
                    <span className="bp-meta-val">{formatWibDateTime(trx.createdAt)}</span>
                  </div>
                  <div className="bp-meta-row">
                    <span className="bp-meta-label">TRX :</span>
                    <span className="bp-meta-val">{trxCode}</span>
                  </div>
                  <div className="bp-meta-row">
                    <span className="bp-meta-label">CUST:</span>
                    <span className="bp-meta-val">{trx.customer || 'GUEST'}</span>
                  </div>
                  {trx.cashierName && (
                    <div className="bp-meta-row">
                      <span className="bp-meta-label">CSHR:</span>
                      <span className="bp-meta-val">{trx.cashierName}</span>
                    </div>
                  )}
                </div>

                <div className="bp-divider" />

                {/* Items List (2-Line Moka POS Format so long names never clip prices on 48mm) */}
                <div className="bp-items">
                  {trx.items.map((item) => (
                    <div key={item.id} className="bp-item">
                      <div className="bp-item-name">{item.productName}</div>
                      <div className="bp-item-calc">
                        <span>
                          {item.quantity} x {formatRupiah(item.price)}
                        </span>
                        <span>{formatRupiah(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bp-divider" />

                {/* Totals & Payments */}
                <div className="bp-totals">
                  <div className="bp-total-row">
                    <span>QTY ({totalQty} ITEMS)</span>
                    <span>{formatRupiah(trx.amount)}</span>
                  </div>
                  <div className="bp-total-row bp-total-main">
                    <span>TOTAL</span>
                    <span>{formatRupiah(trx.amount)}</span>
                  </div>

                  {trx.paidAmount ? (
                    <>
                      <div className="bp-total-row">
                        <span>{trx.paymentMethod ? trx.paymentMethod.toUpperCase() : 'PAID'}</span>
                        <span>{formatRupiah(trx.paidAmount)}</span>
                      </div>
                      {(!trx.paymentMethod ||
                        trx.paymentMethod.toLowerCase() === 'cash' ||
                        trx.paidAmount - trx.amount > 0) && (
                        <div className="bp-total-row">
                          <span>CHANGE</span>
                          <span>{formatRupiah(Math.max(0, trx.paidAmount - trx.amount))}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bp-center" style={{ marginTop: '3px', fontWeight: 900 }}>
                      ** WAITING FOR PAYMENT **
                    </div>
                  )}
                </div>

                <div className="bp-divider" />

                {/* Footer Message */}
                <div className="bp-footer">
                  Thank you for your visit!<br />
                  Instagram: @sorelin.bakery<br />
                  WhatsApp: 082240491826
                </div>
              </div>

              {/* Blueprint Printer Guidance Tip */}
              <div className="mt-3 px-3 py-2 bg-[#FAF0DA] border border-[#E5D5BC] rounded-xl text-[10px] text-[#6B4227] leading-tight text-center w-full max-w-[260px]">
                <span className="font-bold">Setelan Blueprint Lite 58:</span><br />
                Paper size: <b>58mm</b> • Margin: <b>None</b> • Scale: <b>100%</b> • Uncheck <b>Headers &amp; Footers</b>.
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
