import type { ImportFileState } from '../../lib/types';

interface ImportFileListProps {
  files: ImportFileState[];
  currentIndex: number;
  eta: string;
}

/** Status icon component for each file row */
function StatusIcon({ status }: { status: ImportFileState['status'] }) {
  switch (status) {
    case 'done':
      return (
        <svg className="h-4 w-4 shrink-0 text-treez-primary" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'done_with_warnings':
      return (
        <svg className="h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case 'uploading':
    case 'processing':
      return (
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-treez-accent border-t-transparent" />
      );
    default:
      // pending -- gray circle
      return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />;
  }
}

const STATUS_TEXT: Record<string, string> = {
  uploading: 'Uploading...',
  processing: 'Processing...',
};

export function ImportFileList({ files, currentIndex, eta }: ImportFileListProps) {
  return (
    <div className="space-y-1">
      {files.map((file, idx) => {
        const isCurrent = idx === currentIndex;
        const isActive = file.status === 'uploading' || file.status === 'processing';
        const percent = file.rowCount > 0 ? Math.min(100, Math.round((file.processedCount / file.rowCount) * 100)) : 0;

        return (
          <div key={file.key}>
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                file.status === 'done' || file.status === 'done_with_warnings'
                  ? 'border-treez-accent bg-treez-accent-muted'
                  : file.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : isCurrent
                      ? 'border-treez-accent bg-treez-accent-muted'
                      : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/* Top row: icon + label + row count */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <StatusIcon status={file.status} />
                  <span
                    className={`font-medium ${
                      file.status === 'done' || file.status === 'done_with_warnings'
                        ? 'text-treez-primary'
                        : file.status === 'failed'
                          ? 'text-red-700'
                          : isActive
                            ? 'text-treez-primary'
                            : 'text-gray-500'
                    }`}
                  >
                    {file.label}
                  </span>
                  {isCurrent && isActive && (
                    <span className="text-xs text-gray-400">
                      {STATUS_TEXT[file.status] ?? ''}
                    </span>
                  )}
                </div>
                <span
                  className={`shrink-0 text-xs font-medium ${
                    file.status === 'done' || file.status === 'done_with_warnings'
                      ? 'text-treez-text-secondary'
                      : file.status === 'failed'
                        ? 'text-red-600'
                        : isActive
                          ? 'text-gray-600'
                          : 'text-gray-400'
                  }`}
                >
                  {isActive && file.rowCount > 0
                    ? `${file.processedCount.toLocaleString()} / ${file.rowCount.toLocaleString()} rows`
                    : file.rowCount > 0
                      ? `${file.rowCount.toLocaleString()} rows`
                      : ''}
                  {file.errorCount > 0 && (
                    <span className="ml-1 text-red-500">
                      ({file.errorCount} failed)
                    </span>
                  )}
                </span>
              </div>

              {/* Inline progress bar for active file */}
              {isCurrent && isActive && (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-treez-accent transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>

            {/* Error message for failed files */}
            {file.status === 'failed' && file.error && (
              <p className="mt-1 px-2 text-xs text-red-600">{file.error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
