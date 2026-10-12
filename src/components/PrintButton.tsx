'use client';

import { Printer } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
    >
      <Printer className="h-4 w-4" /> Print Now
    </button>
  );
}
