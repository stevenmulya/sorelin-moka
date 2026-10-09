'use client';

import { Eye } from 'lucide-react';
import Link from 'next/link';

export default function TransactionActions({ id }: { id: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <Link href={`/transactions/${id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors" title="View Detail">
        <Eye className="h-3.5 w-3.5" /> View
      </Link>
    </div>
  );
}
