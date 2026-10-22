/**
 * Direct ESC/POS Bluetooth Thermal Printer Engine for Blueprint Lite 58 (58mm / 384 dots).
 * Supports Web Bluetooth API (Chrome on Android, Windows, macOS, and Bluefy Browser on iOS).
 */

import { formatRupiah, generateTrxCode } from '@/lib/utils';
import { formatWibDateTime } from '@/lib/dates';

export interface ThermalPrintItem {
  id: number;
  productName: string;
  quantity: number;
  price: number;
}

export interface ThermalPrintTrx {
  id: number;
  createdAt: Date | string;
  customer?: string | null;
  cashierName?: string | null;
  selfieUrl?: string | null;
  amount: number;
  paidAmount?: number | null;
  paymentMethod?: string | null;
  items: ThermalPrintItem[];
}

// Minimal Web Bluetooth TypeScript declarations
interface WebBluetoothCharacteristic {
  uuid?: string;
  properties: {
    write?: boolean;
    writeWithoutResponse?: boolean;
  };
  writeValue?: (value: Uint8Array | BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: Uint8Array | BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: Uint8Array | BufferSource) => Promise<void>;
}

interface WebBluetoothService {
  uuid: string;
  getCharacteristics: () => Promise<WebBluetoothCharacteristic[]>;
  getCharacteristic?: (uuid: string) => Promise<WebBluetoothCharacteristic>;
}

interface WebBluetoothGATTServer {
  connected: boolean;
  connect: () => Promise<WebBluetoothGATTServer>;
  disconnect: () => void;
  getPrimaryServices: () => Promise<WebBluetoothService[]>;
  getPrimaryService: (uuid: string) => Promise<WebBluetoothService>;
}

interface WebBluetoothDevice {
  id: string;
  name?: string;
  gatt?: WebBluetoothGATTServer;
  addEventListener?: (type: string, listener: () => void) => void;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      filters?: Array<{ services?: string[]; namePrefix?: string }>;
      optionalServices?: string[];
    }) => Promise<WebBluetoothDevice>;
    getDevices?: () => Promise<WebBluetoothDevice[]>;
  };
}

const LAST_PRINTER_STORAGE_KEY = 'sorelin_bt_printer_id';

// Known GATT Service UUIDs used by Blueprint Lite 58, RPP02N, MPT-II, and 58mm BLE printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Printer Service (0x18F0)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // ISSC / Blueprint BLE Transparent UART
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip / ISSC BLE Service
  '0000ae00-0000-1000-8000-00805f9b34fb', // JieLi BLE Printer Service (0xAE00 - Blueprint Lite 58 new batch)
  '0000ae30-0000-1000-8000-00805f9b34fb', // JieLi BLE Printer Service (0xAE30)
  '0000ff00-0000-1000-8000-00805f9b34fb', // 0xFF00 BLE Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // 0xFFE0 HM-10 Serial Service
  '0000ffe5-0000-1000-8000-00805f9b34fb', // 0xFFE5 BLE Printer Service
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
  '0000fee7-0000-1000-8000-00805f9b34fb', // Tencent / JieLi BLE Printer Service
  '0000af30-0000-1000-8000-00805f9b34fb', // Alternative BLE Printer Service
];

const KNOWN_WRITE_CHARACTERISTICS: Array<[string, string]> = [
  ['000018f0-0000-1000-8000-00805f9b34fb', '00002af1-0000-1000-8000-00805f9b34fb'],
  ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'],
  ['49535343-fe7d-4ae5-8fa9-9fafd205e455', '49535343-8841-43f4-a8d4-ecbe34729bb3'],
  ['49535343-fe7d-4ae5-8fa9-9fafd205e455', '49535343-1e4d-4bd9-ba61-23c647249616'],
  ['0000ae00-0000-1000-8000-00805f9b34fb', '0000ae01-0000-1000-8000-00805f9b34fb'],
  ['0000ae00-0000-1000-8000-00805f9b34fb', '0000ae02-0000-1000-8000-00805f9b34fb'],
  ['0000ae30-0000-1000-8000-00805f9b34fb', '0000ae01-0000-1000-8000-00805f9b34fb'],
  ['0000ff00-0000-1000-8000-00805f9b34fb', '0000ff02-0000-1000-8000-00805f9b34fb'],
  ['0000ffe0-0000-1000-8000-00805f9b34fb', '0000ffe1-0000-1000-8000-00805f9b34fb'],
  ['0000ffe5-0000-1000-8000-00805f9b34fb', '0000ffe9-0000-1000-8000-00805f9b34fb'],
  ['6e400001-b5a3-f393-e0a9-e50e24dcca9e', '6e400002-b5a3-f393-e0a9-e50e24dcca9e'],
];

// Cached connection so the cashier doesn't have to re-select the printer on every receipt
let cachedDevice: WebBluetoothDevice | null = null;
let cachedCharacteristic: WebBluetoothCharacteristic | null = null;

export function isWebBluetoothSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const nav = navigator as NavigatorWithBluetooth;
  return Boolean(nav.bluetooth && typeof nav.bluetooth.requestDevice === 'function');
}

export function isIOSDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOS || isIPadOS;
}

export function getConnectedPrinterName(): string | null {
  if (cachedDevice && cachedDevice.gatt?.connected) {
    return cachedDevice.name || 'Blueprint Thermal Printer';
  }
  return null;
}

export function disconnectBluetoothPrinter(): void {
  try {
    if (cachedDevice?.gatt?.connected) {
      cachedDevice.gatt.disconnect();
    }
  } catch {
    // Ignore disconnect errors
  } finally {
    cachedDevice = null;
    cachedCharacteristic = null;
  }
}

async function resolveWritableCharacteristic(
  server: WebBluetoothGATTServer
): Promise<WebBluetoothCharacteristic> {
  // 1. Try known service + exact characteristic UUID pairs first
  for (const [serviceUuid, charUuid] of KNOWN_WRITE_CHARACTERISTICS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      if (service.getCharacteristic) {
        try {
          const exactChar = await service.getCharacteristic(charUuid);
          if (exactChar.properties.write || exactChar.properties.writeWithoutResponse) {
            return exactChar;
          }
        } catch {
          // Characteristic UUID not found directly, inspect list below
        }
      }
      const chars = await service.getCharacteristics();
      const exactMatch = chars.find(
        (c) =>
          c.uuid?.toLowerCase() === charUuid.toLowerCase() &&
          (c.properties.write || c.properties.writeWithoutResponse)
      );
      if (exactMatch) return exactMatch;

      const writable = chars.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );
      if (writable) return writable;
    } catch {
      // Service not present on this printer model, continue checking
    }
  }

  // 2. Fallback: enumerate all primary services exposed by the printer
  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        const writable = chars.find(
          (c) => c.properties.write || c.properties.writeWithoutResponse
        );
        if (writable) return writable;
      } catch {
        // Continue scanning next service
      }
    }
  } catch {
    // Ignore enumeration error
  }

  throw new Error(
    'Tidak ditemukan karakteristik tulis (Write GATT) pada perangkat Bluetooth ini. Pastikan perangkat yang dipilih adalah printer Blueprint Lite 58.'
  );
}

/**
 * Attempt to silently restore a previously permitted Bluetooth printer across page reloads
 * if the browser supports `navigator.bluetooth.getDevices()`.
 */
export async function tryRestorePermittedPrinter(): Promise<string | null> {
  if (cachedDevice && cachedDevice.gatt?.connected) {
    return cachedDevice.name || 'Blueprint Lite 58';
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const nav = navigator as NavigatorWithBluetooth;
  if (!nav.bluetooth?.getDevices) return null;

  try {
    const devices = await nav.bluetooth.getDevices();
    if (!devices || devices.length === 0) return null;
    const savedId = window.localStorage.getItem(LAST_PRINTER_STORAGE_KEY);
    const target = (savedId && devices.find((d) => d.id === savedId)) || devices[0];
    if (!target?.gatt) return null;

    const server = await target.gatt.connect();
    const characteristic = await resolveWritableCharacteristic(server);
    cachedDevice = target;
    cachedCharacteristic = characteristic;
    return target.name || 'Blueprint Lite 58';
  } catch {
    return null;
  }
}

export async function connectBluetoothPrinter(
  forceNewDevice = false
): Promise<{ name: string; characteristic: WebBluetoothCharacteristic }> {
  const nav = navigator as NavigatorWithBluetooth;
  if (!nav.bluetooth) {
    throw new Error(
      isIOSDevice()
        ? 'Browser Safari/Chrome di iOS memblokir Web Bluetooth. Gunakan aplikasi browser gratis "Bluefy" di App Store untuk cetak Bluetooth langsung dari iPhone/iPad.'
        : 'Browser ini tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Microsoft Edge.'
    );
  }

  // Reuse existing active connection if available
  if (!forceNewDevice && cachedDevice && cachedCharacteristic && cachedDevice.gatt?.connected) {
    return {
      name: cachedDevice.name || 'Blueprint Lite 58',
      characteristic: cachedCharacteristic,
    };
  }

  // If we have a previously selected device that disconnected (e.g. standby), try reconnecting first
  if (!forceNewDevice && cachedDevice?.gatt) {
    try {
      const server = await cachedDevice.gatt.connect();
      const characteristic = await resolveWritableCharacteristic(server);
      cachedCharacteristic = characteristic;
      return {
        name: cachedDevice.name || 'Blueprint Lite 58',
        characteristic,
      };
    } catch {
      cachedDevice = null;
      cachedCharacteristic = null;
    }
  }

  // Request user to pick the printer in the browser Bluetooth chooser
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  if (!device.gatt) {
    throw new Error('Perangkat Bluetooth tidak mendukung GATT Server.');
  }

  device.addEventListener?.('gattserverdisconnected', () => {
    cachedCharacteristic = null;
  });

  const server = await device.gatt.connect();
  const characteristic = await resolveWritableCharacteristic(server);

  cachedDevice = device;
  cachedCharacteristic = characteristic;
  try {
    window.localStorage.setItem(LAST_PRINTER_STORAGE_KEY, device.id);
  } catch {
    // Ignore storage errors
  }

  return {
    name: device.name || 'Blueprint Lite 58',
    characteristic,
  };
}

async function writeSingleBleChunk(
  characteristic: WebBluetoothCharacteristic,
  chunk: Uint8Array
): Promise<void> {
  const canWithoutResponse = Boolean(
    characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse
  );
  const canWithResponse = Boolean(
    characteristic.properties.write && characteristic.writeValueWithResponse
  );

  if (canWithoutResponse && characteristic.writeValueWithoutResponse) {
    try {
      await characteristic.writeValueWithoutResponse(chunk);
      return;
    } catch {
      // Fallback to writeValueWithResponse / writeValue below
    }
  }

  if (canWithResponse && characteristic.writeValueWithResponse) {
    try {
      await characteristic.writeValueWithResponse(chunk);
      return;
    } catch {
      // Fallback to writeValue below
    }
  }

  if (characteristic.writeValue) {
    await characteristic.writeValue(chunk);
    return;
  }

  throw new Error('Karakteristik Bluetooth tidak mendukung penulisan data.');
}

/**
 * Send raw ESC/POS bytes in safe BLE chunks so Blueprint Lite 58 internal buffer never overflows.
 * Automatically falls back to 20-byte standard BLE MTU packets if the device rejects larger chunks.
 */
async function sendBytesInChunks(
  characteristic: WebBluetoothCharacteristic,
  data: Uint8Array
): Promise<void> {
  let chunkSize = 64;

  for (let offset = 0; offset < data.length; ) {
    const end = Math.min(offset + chunkSize, data.length);
    const chunk = data.slice(offset, end);
    try {
      await writeSingleBleChunk(characteristic, chunk);
      offset = end;
      await new Promise((r) => setTimeout(r, 15));
    } catch (err) {
      if (chunkSize > 20) {
        // Device negotiated a strict 20-byte BLE MTU (common on iOS Bluefy / older Android); retry with 20B
        chunkSize = 20;
      } else {
        throw err;
      }
    }
  }
}

// ============================================================================
// ESC/POS ENCODING HELPERS (32 Characters per Line on 58mm Font A)
// ============================================================================

const LINE_WIDTH = 32;

function encodeAscii(text: string): number[] {
  const bytes: number[] = [];
  // Normalize special characters to safe ASCII for standard ESC/POS codepage
  const clean = text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '');
  for (let i = 0; i < clean.length; i++) {
    bytes.push(clean.charCodeAt(i));
  }
  return bytes;
}

function encodeLine(text = ''): number[] {
  return [...encodeAscii(text), 0x0a];
}

function formatLeftRight(left: string, right: string, width = LINE_WIDTH): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const maxLeft = Math.max(1, width - cleanRight.length - 1);
  const truncatedLeft =
    cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
  const spaces = Math.max(1, width - truncatedLeft.length - cleanRight.length);
  return truncatedLeft + ' '.repeat(spaces) + cleanRight;
}

function wrapText(text: string, width = LINE_WIDTH): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.length > width ? word.slice(0, width) : word;
    } else if (current.length + 1 + word.length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/**
 * Convert an image URL into ESC/POS Raster Bit Image commands (`GS v 0`)
 * sent in 24-dot vertical bands so BLE buffers never choke.
 */
async function imageToEscPosRasterBands(
  src: string,
  targetWidthPx: number,
  mode: 'logo' | 'selfie'
): Promise<number[]> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Width must be a multiple of 8 for byte-aligned GS v 0 raster rows
        const w = Math.floor(targetWidthPx / 8) * 8;
        const h = Math.max(8, Math.round((img.height / img.width) * w));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
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
          const alpha = data[idx + 3];
          if (alpha < 128) {
            lum[i] = 255;
            continue;
          }
          const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (mode === 'logo') {
            // Knock out cream #FAF0DA background (>= 202) to pure white
            if (gray >= 202) {
              lum[i] = 255;
            } else {
              lum[i] = Math.max(0, Math.min(255, ((gray - 85) / (202 - 85)) * 255));
            }
          } else {
            // Selfie contrast boost
            lum[i] = Math.min(255, Math.max(0, (gray - 128) * 1.25 + 135));
          }
        }

        // Atkinson 1-bit dithering
        const threshold = mode === 'logo' ? 140 : 128;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const oldPixel = lum[i];
            const newPixel = oldPixel < threshold ? 0 : 255;
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

        // Add 1px black frame around customer selfie
        if (mode === 'selfie') {
          for (let x = 0; x < w; x++) {
            lum[x] = 0;
            lum[(h - 1) * w + x] = 0;
          }
          for (let y = 0; y < h; y++) {
            lum[y * w] = 0;
            lum[y * w + (w - 1)] = 0;
          }
        }

        // Encode into GS v 0 bands of 24 rows each
        const bytesPerRow = w / 8;
        const BAND_HEIGHT = 24;
        const commands: number[] = [];

        // Center align
        commands.push(0x1b, 0x61, 0x01);

        for (let yStart = 0; yStart < h; yStart += BAND_HEIGHT) {
          const bandH = Math.min(BAND_HEIGHT, h - yStart);
          // GS v 0 m xL xH yL yH
          commands.push(
            0x1d,
            0x76,
            0x30,
            0x00,
            bytesPerRow & 0xff,
            (bytesPerRow >> 8) & 0xff,
            bandH & 0xff,
            (bandH >> 8) & 0xff
          );

          for (let y = yStart; y < yStart + bandH; y++) {
            for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
              let b = 0;
              for (let bit = 0; bit < 8; bit++) {
                const x = byteIdx * 8 + bit;
                if (lum[y * w + x] < 128) {
                  b |= 1 << (7 - bit);
                }
              }
              commands.push(b);
            }
          }
        }

        resolve(commands);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = src;
  });
}

/**
 * Build the complete ESC/POS byte stream for a Sorelin Bakery receipt on Blueprint Lite 58.
 */
export async function buildEscPosReceipt(
  trx: ThermalPrintTrx,
  includePhoto: boolean
): Promise<Uint8Array> {
  const trxCode = generateTrxCode(trx.id, trx.createdAt, trx.customer);
  const totalQty = trx.items.reduce((acc, item) => acc + item.quantity, 0);
  const divider = '-'.repeat(LINE_WIDTH);

  const bytes: number[] = [];

  // 1. Initialize printer (ESC @) & select standard character font A
  bytes.push(0x1b, 0x40);
  bytes.push(0x1b, 0x4d, 0x00);

  // 2. Print Sorelin Secondary Lockup Logo (208px wide centered on 384px thermal head)
  const logoBytes = await imageToEscPosRasterBands('/sorelin-lockup-secondary.png', 208, 'logo');
  if (logoBytes.length > 0) {
    bytes.push(...logoBytes);
  } else {
    // Fallback text header if image fails to load
    bytes.push(0x1b, 0x61, 0x01); // Center
    bytes.push(0x1b, 0x45, 0x01); // Bold On
    bytes.push(...encodeLine('SORELIN BAKERY'));
    bytes.push(0x1b, 0x45, 0x00); // Bold Off
  }

  // Subtitle
  bytes.push(0x1b, 0x61, 0x01); // Center
  bytes.push(0x1b, 0x45, 0x01); // Bold On
  bytes.push(...encodeLine('FRESHLY BAKED SALTBREAD'));
  bytes.push(0x1b, 0x45, 0x00); // Bold Off
  bytes.push(...encodeLine(divider));

  // 3. Optional Customer Selfie Photo (240px wide 1-bit dithered raster)
  if (includePhoto && trx.selfieUrl) {
    const selfieBytes = await imageToEscPosRasterBands(trx.selfieUrl, 240, 'selfie');
    if (selfieBytes.length > 0) {
      bytes.push(...selfieBytes);
      bytes.push(0x0a);
    }
  }

  // 4. Metadata (Left Aligned)
  bytes.push(0x1b, 0x61, 0x00); // Left align
  bytes.push(...encodeLine(formatLeftRight('DATE:', formatWibDateTime(trx.createdAt))));
  bytes.push(...encodeLine(formatLeftRight('TRX :', trxCode)));
  bytes.push(...encodeLine(formatLeftRight('CUST:', (trx.customer || 'GUEST').toUpperCase())));
  if (trx.cashierName) {
    bytes.push(...encodeLine(formatLeftRight('CSHR:', trx.cashierName.toUpperCase())));
  }
  bytes.push(...encodeLine(divider));

  // 5. Items List (2-Line Moka POS Format)
  for (const item of trx.items) {
    bytes.push(0x1b, 0x45, 0x01); // Bold On for product name
    for (const line of wrapText(item.productName, LINE_WIDTH)) {
      bytes.push(...encodeLine(line));
    }
    bytes.push(0x1b, 0x45, 0x00); // Bold Off

    const leftCalc = `${item.quantity} x ${formatRupiah(item.price)}`;
    const rightTotal = formatRupiah(item.price * item.quantity);
    bytes.push(...encodeLine(formatLeftRight(leftCalc, rightTotal)));
  }
  bytes.push(...encodeLine(divider));

  // 6. Totals & Payment
  bytes.push(
    ...encodeLine(formatLeftRight(`QTY (${totalQty} ITEMS)`, formatRupiah(trx.amount)))
  );

  bytes.push(0x1b, 0x45, 0x01); // Bold On for TOTAL
  bytes.push(...encodeLine(formatLeftRight('TOTAL', formatRupiah(trx.amount))));
  bytes.push(0x1b, 0x45, 0x00); // Bold Off

  if (trx.paidAmount) {
    const methodLabel = trx.paymentMethod ? trx.paymentMethod.toUpperCase() : 'PAID';
    bytes.push(...encodeLine(formatLeftRight(methodLabel, formatRupiah(trx.paidAmount))));
    if (
      !trx.paymentMethod ||
      trx.paymentMethod.toLowerCase() === 'cash' ||
      trx.paidAmount - trx.amount > 0
    ) {
      const change = Math.max(0, trx.paidAmount - trx.amount);
      bytes.push(...encodeLine(formatLeftRight('CHANGE', formatRupiah(change))));
    }
  } else {
    bytes.push(0x1b, 0x61, 0x01); // Center
    bytes.push(0x1b, 0x45, 0x01);
    bytes.push(...encodeLine('** WAITING FOR PAYMENT **'));
    bytes.push(0x1b, 0x45, 0x00);
    bytes.push(0x1b, 0x61, 0x00); // Left
  }

  bytes.push(...encodeLine(divider));

  // 7. Footer (Centered)
  bytes.push(0x1b, 0x61, 0x01); // Center
  bytes.push(...encodeLine('Thank you for your visit!'));
  bytes.push(...encodeLine('Instagram: @sorelin.bakery'));
  bytes.push(...encodeLine('WhatsApp: 082240491826'));

  // 8. Feed 4 lines so user can tear paper cleanly
  bytes.push(0x0a, 0x0a, 0x0a, 0x0a);

  return new Uint8Array(bytes);
}

/**
 * Connect (or reuse connection) to Blueprint Lite 58 and immediately print the receipt.
 */
export async function printReceiptViaBluetooth(
  trx: ThermalPrintTrx,
  includePhoto: boolean,
  forceNewDevice = false
): Promise<string> {
  const { name, characteristic } = await connectBluetoothPrinter(forceNewDevice);
  const payload = await buildEscPosReceipt(trx, includePhoto);
  await sendBytesInChunks(characteristic, payload);
  return name;
}
