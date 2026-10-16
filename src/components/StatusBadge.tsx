import { STATUS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function getStatusTheme(status: string) {
  switch (status) {
    case STATUS.WAITING:
      return 'bg-[#FEF6E7] text-[#9A6208] border-[#F3DBAA]';
    case STATUS.PREPARING:
      return 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]';
    case STATUS.READY:
      return 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]';
    case STATUS.PICKED_UP:
      return 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]';
    case STATUS.CLOSED:
      return 'bg-[#FAF0DA] text-[#8E6D53] border-[#E5D5BC]';
    case STATUS.CANCELLED:
      return 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
    default:
      return 'bg-[#FAF0DA] text-[#8E6D53] border-[#E5D5BC]';
  }
}

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const theme = getStatusTheme(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        theme,
        className
      )}
    >
      {status}
    </span>
  );
}
