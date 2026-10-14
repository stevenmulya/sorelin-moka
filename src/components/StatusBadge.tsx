import { STATUS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function getStatusTheme(status: string) {
  switch (status) {
    case STATUS.WAITING:
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case STATUS.PREPARING:
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case STATUS.READY:
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case STATUS.PICKED_UP:
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case STATUS.CLOSED:
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case STATUS.CANCELLED:
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
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
