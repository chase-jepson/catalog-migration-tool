import type { ImportFileState } from '../../lib/types';
import { ImportProgress } from './ImportProgress';

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
        <svg className="h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
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
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
      );
    default:
      // pending -- gray circle
      return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />;
  }
}

export function ImportFileList({ files, currentIndex, eta }: ImportFileListProps) {
  return (
    <div className="space-y-1">
      {files.map((file, idx) => {
        const isCurrent = idx === currentIndex;
        const isActive = file.status === 'uploading' || file.status === 'processing';

        return (
          <div key={file.key}>
            <div
              className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-sm ${
                file.status === 'done' || file.status === 'done_with_warnings'
                  ? 'border-green-200 bg-green-50'
                  : file.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : isCurrent
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <StatusIcon status={file.status} />
                <span
                  className={
                    file.status === 'done' || file.status === 'done_with_warnings'
                      ? 'text-green-700'
                      : file.status === 'failed'
                        ? 'text-red-700'
                        : isActive
                          ? 'text-teal-700'
                          : 'text-gray-500'
                  }
                >
                  {file.label}
                </span>
              </div>
              <span
                className={`text-xs font-medium ${
                  file.status === 'done' || file.status === 'done_with_warnings'
                    ? 'text-green-600'
                    : file.status === 'failed'
                      ? 'text-red-600'
                      : 'text-gray-400'
                }`}
              >
                {file.rowCount > 0 ? `${file.rowCount.toLocaleString()} rows` : ''}
                {file.errorCount > 0 && (
                  <span className="ml-1 text-red-500">
                    ({file.errorCount} failed)
                  </span>
                )}
              </span>
            </div>

            {/* Show progress bar for current active file */}
            {isCurrent && isActive && (
              <div className="mt-1 px-1">
                <ImportProgress
                  fileLabel={file.label}
                  status={file.status}
                  processedCount={file.processedCount}
                  totalRows={file.rowCount}
                  eta={eta}
                />
              </div>
            )}

            {/* Show error message for failed files */}
            {file.status === 'failed' && file.error && (
              <p className="mt-1 px-2 text-xs text-red-600">{file.error}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
