'use client';

import { LogOut } from 'lucide-react';
import { closeShift } from '@/app/actions';
import ActionForm, { SubmitButton } from '@/components/ActionForm';
import { formatRupiah } from '@/lib/utils';

export default function CloseShiftForm({
  shiftId,
  expectedCash,
  pendingCount,
  activeKitchenCount = 0,
  openedBy,
}: {
  shiftId: number;
  expectedCash: number;
  pendingCount: number;
  activeKitchenCount?: number;
  openedBy: string;
}) {
  const warnings: string[] = [];
  if (pendingCount > 0) {
    warnings.push(`${pendingCount} unpaid "Waiting Payment" order(s) will be automatically cancelled.`);
  }
  if (activeKitchenCount > 0) {
    warnings.push(`${activeKitchenCount} active kitchen order(s) will be marked as completed/closed.`);
  }

  const confirmMsg =
    warnings.length > 0
      ? `Please confirm before closing shift:\n- ${warnings.join('\n- ')}\n\nClose shift now?`
      : 'Are you sure you want to close this shift?';

  return (
    <ActionForm action={closeShift} confirmMessage={confirmMsg} className="space-y-4">
      <input type="hidden" name="shiftId" value={shiftId} />

      <div>
        <label className="block text-xs font-bold text-[#3F2311] mb-1">Closed By</label>
        <input
          type="text"
          name="closedBy"
          required
          defaultValue={openedBy}
          maxLength={60}
          placeholder="Enter cashier name"
          className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs font-semibold text-[#3F2311] focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] focus:outline-none transition-all"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-[#3F2311]">
            Actual Cash in Drawer (Uang Kas Fisik)
          </label>
          <span className="text-[11px] font-semibold text-[#8E6D53]">
            Expected: {formatRupiah(expectedCash)}
          </span>
        </div>
        <input
          type="number"
          name="actualCash"
          defaultValue={expectedCash >= 0 ? expectedCash : 0}
          min={0}
          placeholder="Enter counted physical cash"
          className="w-full px-3.5 py-2.5 bg-[#FAF0DA]/40 border border-[#E5D5BC] rounded-xl text-xs font-semibold text-[#3F2311] focus:ring-2 focus:ring-[#6B4227] focus:bg-[#FFFDF8] focus:outline-none transition-all"
        />
        <p className="text-[11px] text-[#8E6D53] mt-1">
          Hitung fisik uang tunai di laci kasir saat tutup shift. Otomatis terisi sesuai ekspektasi kas sistem.
        </p>
      </div>

      {pendingCount > 0 && (
        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-medium">
          {pendingCount} unpaid order(s) will be automatically cancelled upon closing.
        </div>
      )}

      {activeKitchenCount > 0 && (
        <div className="p-3 bg-[#F3DBAA]/50 text-[#6B4227] border border-[#E5D5BC] rounded-xl text-xs font-medium">
          {activeKitchenCount} order(s) currently in the kitchen queue will be archived upon closing.
        </div>
      )}

      <SubmitButton
        pendingText="Closing Shift..."
        className="w-full py-2.5 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mt-2 shadow-xs cursor-pointer"
      >
        <LogOut className="h-4 w-4" /> Close Shift
      </SubmitButton>
    </ActionForm>
  );
}
