import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import ShiftTimer from '@/components/ShiftTimer';
import { prisma } from '@/lib/prisma';
import { formatRupiah } from '@/lib/utils';
import { formatWibDate } from '@/lib/dates';
export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const activeShift = await prisma.shift.findFirst({
    where: { status: 'Open' }
  });

  return (
    <div className="flex h-screen bg-[#FAF7F2] text-[#382213] font-sans antialiased w-full">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-[#FFFDF9] border-b border-[#EADBCC]">
          <div className="flex items-center md:hidden">
            <div className="font-extrabold text-lg text-[#4A2E1B]">
              Sorelin <span className="text-[#C69234] font-medium">Moka</span>
            </div>
          </div>
          <div className="hidden md:block">
            {/* Title / Brand Info */}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 w-full md:w-auto">
            {!activeShift ? (
              <>
                <span className="hidden sm:inline-block text-sm font-medium text-[#7A6251]">
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
                <div className="hidden lg:flex items-center gap-3 text-xs text-[#7A6251] bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#EADBCC]">
                  <span>{formatWibDate(new Date())}</span>
                  <span className="w-1 h-1 bg-[#D8C6B5] rounded-full"></span>
                  <span>Cashier: <span className="font-semibold text-[#4A2E1B]">{activeShift.openedBy}</span></span>
                  <span className="w-1 h-1 bg-[#D8C6B5] rounded-full"></span>
                  <span>Initial Float: <span className="font-semibold text-[#4A2E1B]">{formatRupiah(activeShift.initialCash)}</span></span>
                  <span className="w-1 h-1 bg-[#D8C6B5] rounded-full"></span>
                  <span>Duration: <ShiftTimer startTime={activeShift.startTime} /></span>
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
        <main className="flex-1 overflow-y-auto bg-[#FAF7F2] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
