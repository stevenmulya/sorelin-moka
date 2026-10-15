import { BUSINESS_UTC_OFFSET_HOURS } from '@/lib/constants';

/**
 * Semua perhitungan "hari" memakai WIB (UTC+7) secara eksplisit lewat aritmetika,
 * bukan zona waktu mesin. Hasilnya sama di laptop WIB, server UTC, maupun browser.
 */
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const OFFSET = BUSINESS_UTC_OFFSET_HOURS * HOUR;

export function startOfWibDay(date: Date): Date {
  return new Date(Math.floor((date.getTime() + OFFSET) / DAY) * DAY - OFFSET);
}

export function endOfWibDay(date: Date): Date {
  return new Date(startOfWibDay(date).getTime() + DAY - 1);
}

/** 'YYYY-MM-DD' menurut kalender WIB. */
export function formatWibDate(date: Date): string {
  const d = new Date(date.getTime() + OFFSET);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format jam 'HH:mm' menurut WIB. */
export function formatWibTime(date: Date | string): string {
  const d = new Date(new Date(date).getTime() + OFFSET);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/** Format tanggal & jam 'YYYY-MM-DD HH:mm WIB' */
export function formatWibDateTime(date: Date | string): string {
  const d = new Date(date);
  return `${formatWibDate(d)} ${formatWibTime(d)} WIB`;
}

/** Jam (0-23) menurut WIB. */
export function wibHour(date: Date): number {
  return new Date(date.getTime() + OFFSET).getUTCHours();
}

/** Parse 'YYYY-MM-DD' menjadi awal hari WIB. null bila tidak valid. */
export function parseWibDate(value: string | undefined | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const check = new Date(utc);
  // tolak tanggal mustahil seperti 2026-02-31
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc - OFFSET);
}

export type RangePreset = 'this_shift' | 'today' | 'week' | 'month' | 'all' | 'custom';

export interface ResolvedRange {
  preset: RangePreset;
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  /** null untuk preset "all" */
  days: number | null;
}

const PRESETS: RangePreset[] = ['this_shift', 'today', 'week', 'month', 'all', 'custom'];

export function normalizePreset(value: string | undefined | null): RangePreset {
  return PRESETS.includes(value as RangePreset) ? (value as RangePreset) : 'this_shift';
}

/**
 * Satu-satunya tempat menerjemahkan filter laporan -> rentang waktu.
 * Dipakai bersama oleh halaman laporan dan endpoint export agar angkanya selalu sama.
 */
export function resolveRange(
  params: { preset?: string | null; start?: string | null; end?: string | null },
  activeShiftStart: Date | null,
  now: Date = new Date(),
): ResolvedRange {
  const preset = normalizePreset(params.preset);
  let start: Date;
  let end: Date;

  switch (preset) {
    case 'this_shift':
      if (activeShiftStart) {
        start = new Date(activeShiftStart);
        end = now;
      } else {
        start = startOfWibDay(now);
        end = endOfWibDay(now);
      }
      break;
    case 'all':
      start = new Date(0);
      end = new Date(now.getTime() + 365 * DAY);
      break;
    case 'week':
      start = startOfWibDay(new Date(now.getTime() - 7 * DAY));
      end = endOfWibDay(now);
      break;
    case 'month':
      start = startOfWibDay(new Date(now.getTime() - 30 * DAY));
      end = endOfWibDay(now);
      break;
    case 'custom': {
      const s = parseWibDate(params.start);
      const e = parseWibDate(params.end);
      start = s ?? startOfWibDay(now);
      end = endOfWibDay(e ?? now);
      break;
    }
    case 'today':
    default:
      start = startOfWibDay(now);
      end = endOfWibDay(now);
  }

  // Jika terbalik, tukar (hanya relevan untuk custom)
  if (start > end) {
    const s = startOfWibDay(end);
    const e = endOfWibDay(start);
    start = s;
    end = e;
  }

  return {
    preset,
    start,
    end,
    startStr: preset === 'all' ? '' : formatWibDate(start),
    endStr: preset === 'all' ? '' : formatWibDate(end),
    days: preset === 'all' ? null : Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY)),
  };
}
