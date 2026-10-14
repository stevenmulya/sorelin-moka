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
    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
      <span className="text-sm text-gray-500">
        Showing {from} to {to} of {totalItems} items
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(basePath, params, Math.max(1, current - 1))}
          className={`p-2 rounded-md ${current === 1 ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {pageList(current, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="min-w-[32px] h-8 flex items-center justify-center text-gray-400 text-sm">…</span>
          ) : (
            <Link
              key={p}
              href={buildHref(basePath, params, p)}
              className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium ${
                current === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={buildHref(basePath, params, Math.min(totalPages, current + 1))}
          className={`p-2 rounded-md ${current === totalPages ? 'text-gray-300 pointer-events-none' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
