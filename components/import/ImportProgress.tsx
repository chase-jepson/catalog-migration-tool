import type { FileStatus } from '../../lib/types';

interface ImportProgressProps {
  fileLabel: string;
  status: FileStatus;
  processedCount: number;
  totalRows: number;
  eta: string;
}

const STATUS_TEXT: Record<string, string> = {
  uploading: 'Uploading...',
  processing: 'Processing...',
  done: 'Complete',
  done_with_warnings: 'Complete with warnings',
  failed: 'Failed',
};

export function ImportProgress({
  fileLabel,
  status,
  processedCount,
  totalRows,
  eta,
}: ImportProgressProps) {
  const percent =
    totalRows > 0 ? Math.min(100, Math.round((processedCount / totalRows) * 100)) : 0;

  const barColor =
    status === 'failed'
      ? 'bg-red-500'
      : status === 'done_with_warnings'
        ? 'bg-amber-500'
        : 'bg-teal-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">
          {fileLabel} -- {STATUS_TEXT[status] ?? status}
        </span>
        {totalRows > 0 && (
          <span className="text-gray-500">
            {processedCount.toLocaleString()} / {totalRows.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* ETA */}
      {eta && status !== 'done' && status !== 'failed' && (
        <p className="text-[10px] text-gray-400">{eta}</p>
      )}
    </div>
  );
}
