import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v); // URLSearchParams automatically encodes special characters
  }
  qs.set('page', String(page));
  return `${basePath}?${qs.toString()}`;
}

/** Compact page list: 1 … (current±2) … last */
function pageList(current: number, total: number): (number | '…')[] {
  const set = new Set<number>([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export default function Pagination({
  page,
  totalPages,
  basePath,
  params,
  totalItems,
  pageSize,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: Record<string, string | undefined>;
  totalItems: number;
  pageSize: number;
}) {
  if (totalPages <= 1) return null;
  const current = Math.min(page, totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, totalItems);

  return (
    <div className="px-6 py-4 border-t border-[#E5D5BC] flex items-center justify-between bg-[#FFFDF8]">
      <span className="text-sm text-[#8E6D53]">
        Showing <span className="font-semibold text-[#3F2311]">{from}</span> to <span className="font-semibold text-[#3F2311]">{to}</span> of{' '}
        <span className="font-semibold text-[#3F2311]">{totalItems}</span> items
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(basePath, params, Math.max(1, current - 1))}
          className={`p-2 rounded-lg transition-colors ${
            current === 1 ? 'text-[#CBB9A8] pointer-events-none' : 'text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA]'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pageList(current, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="min-w-[32px] h-8 flex items-center justify-center text-[#9E826B] text-sm">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={buildHref(basePath, params, p)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                current === p ? 'bg-[#6B4227] text-[#FAF0DA] shadow-xs' : 'text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA]'
              }`}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={buildHref(basePath, params, Math.min(totalPages, current + 1))}
          className={`p-2 rounded-lg transition-colors ${
            current === totalPages ? 'text-[#CBB9A8] pointer-events-none' : 'text-[#8E6D53] hover:text-[#6B4227] hover:bg-[#FAF0DA]'
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
