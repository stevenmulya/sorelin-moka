import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import ShiftTimer from '@/components/ShiftTimer';
import { getActiveShift } from '@/lib/services/shifts';
import { formatRupiah } from '@/lib/utils';
import { formatWibDate } from '@/lib/dates';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeShift = await getActiveShift();

  return (
    <div className="flex h-screen bg-[#FAF0DA] text-[#3F2311] font-sans antialiased w-full">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-[#FFFDF8] border-b border-[#E5D5BC]">
          <div className="flex items-center pl-11 md:hidden">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sorelin-logo-brown.png"
                alt="Sorelin"
                className="h-6 w-auto object-contain"
              />
            </Link>
          </div>
          <div className="hidden md:block">
            {/* Title / Brand Info */}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 ml-auto">
            {!activeShift ? (
              <>
                <span className="hidden sm:inline-block text-sm font-medium text-[#8E6D53]">
                  No active cashier shift
                </span>
                <Link
                  href="/shift"
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors shadow-xs border bg-emerald-50 border-emerald-200 hover:bg-emerald-100 text-emerald-800 animate-pulse"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-sm font-semibold">Open Shift</span>
                </Link>
              </>
            ) : (
              <>
                <div className="hidden lg:flex items-center gap-3 text-xs text-[#8E6D53] bg-[#FAF0DA] px-3 py-1.5 rounded-lg border border-[#E5D5BC]">
                  <span>{formatWibDate(new Date())}</span>
                  <span className="w-1 h-1 bg-[#D5C1A1] rounded-full"></span>
                  <span>
                    Cashier: <span className="font-semibold text-[#6B4227]">{activeShift.openedBy}</span>
                  </span>
                  <span className="w-1 h-1 bg-[#D5C1A1] rounded-full"></span>
                  <span>
                    Initial Float: <span className="font-semibold text-[#6B4227]">{formatRupiah(activeShift.initialCash)}</span>
                  </span>
                  <span className="w-1 h-1 bg-[#D5C1A1] rounded-full"></span>
                  <span>
                    Duration: <ShiftTimer startTime={activeShift.startTime} />
                  </span>
                </div>

                <Link
                  href="/shift"
                  className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors shadow-xs border bg-red-50 border-red-200 hover:bg-red-100 text-red-800"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-sm font-semibold">Close Shift</span>
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Main area */}
        <main className="flex-1 overflow-y-auto bg-[#FAF0DA] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
