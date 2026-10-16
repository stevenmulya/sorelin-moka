'use client';

import { Eye } from 'lucide-react';
import Link from 'next/link';

export default function TransactionActions({ id }: { id: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <Link
        href={`/transactions/${id}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6B4227] text-[#FAF0DA] rounded-xl text-xs font-semibold hover:bg-[#54311B] transition-colors shadow-xs"
        title="View Order Details"
      >
        <Eye className="h-3.5 w-3.5" /> View
      </Link>
    </div>
  );
}
