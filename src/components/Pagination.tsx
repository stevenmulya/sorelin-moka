import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v); // URLSearchParams otomatis meng-encode (aman untuk & # spasi)
  }
  qs.set('page', String(page));
  return `${basePath}?${qs.toString()}`;
}

/** Daftar halaman ringkas: 1 … (current±2) … last */
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
    <div className="px-6 py-4 border-t border-[#EADBCC] flex items-center justify-between bg-[#FFFDF9]">
      <span className="text-sm text-[#7A6251]">
        Showing <span className="font-semibold text-[#382213]">{from}</span> to <span className="font-semibold text-[#382213]">{to}</span> of{' '}
        <span className="font-semibold text-[#382213]">{totalItems}</span> items
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(basePath, params, Math.max(1, current - 1))}
          className={`p-2 rounded-lg transition-colors ${
            current === 1 ? 'text-[#CBB9A8] pointer-events-none' : 'text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2]'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pageList(current, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="min-w-[32px] h-8 flex items-center justify-center text-[#A89687] text-sm">…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(basePath, params, p)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                current === p ? 'bg-[#4A2E1B] text-[#FFFDF9] shadow-xs' : 'text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2]'
              }`}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={buildHref(basePath, params, Math.min(totalPages, current + 1))}
          className={`p-2 rounded-lg transition-colors ${
            current === totalPages ? 'text-[#CBB9A8] pointer-events-none' : 'text-[#7A6251] hover:text-[#4A2E1B] hover:bg-[#FAF7F2]'
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
