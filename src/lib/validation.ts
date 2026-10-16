/** Error whose message is safe to display directly to the end user. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** Extract and normalize a single-line string from FormData with a maximum length. */
export function cleanStr(value: FormDataEntryValue | string | null | undefined, maxLen = 200): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

/** Extract and trim a multi-line text field (e.g. description) with a maximum length. */
export function cleanText(value: FormDataEntryValue | string | null | undefined, maxLen = 1000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/** Strict integer parser. Returns null if not a valid safe integer within bounds. */
export function parseInteger(
  value: FormDataEntryValue | string | number | null | undefined,
  opts: { min?: number; max?: number } = {},
): number | null {
  const { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = opts;
  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) n = Number(value.trim());
  else return null;
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

/** Parse an integer or throw a UserError with a clear validation message. */
export function requireInteger(
  value: FormDataEntryValue | string | number | null | undefined,
  label: string,
  opts: { min?: number; max?: number } = {},
): number {
  const n = parseInteger(value, opts);
  if (n === null) {
    const range =
      opts.min !== undefined && opts.max !== undefined
        ? ` (${opts.min}–${opts.max})`
        : opts.min !== undefined
          ? ` (min. ${opts.min})`
          : '';
    throw new UserError(`${label} is invalid${range}.`);
  }
  return n;
}

/** Parse a 1-indexed page number from query parameters. */
export function parsePage(value: string | string[] | undefined): number {
  const n = parseInteger(typeof value === 'string' ? value : undefined, { min: 1, max: 100000 });
  return n ?? 1;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isEmail(value: string): boolean {
  return value.length <= 120 && EMAIL_RE.test(value);
}

/** Return a user-safe error message while masking unexpected internal exceptions. */
export function toUserMessage(e: unknown): string {
  if (e instanceof UserError) return e.message;
  console.error('[action error]', e);
  return 'A server error occurred. Please try again.';
}
