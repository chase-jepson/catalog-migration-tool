import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildInventoryCSV, INVENTORY_OUTPUT_COLUMNS } from '../../lib/inventory-csv-generator';
import { sendMessage } from '../../lib/messaging';
import { buildUploadPayload } from '../../lib/file-uploader';
import { getAdaptiveInterval, isTerminalStatus, MAX_POLL_DURATION_MS } from '../../lib/import-poller';
import { detectEnvironment, getApiBaseUrl } from '../../lib/env';
import type {
  InventoryDerivedRow,
  StoreInfo,
} from '../../lib/types';

interface InventoryImportStepProps {
  derivedRows: InventoryDerivedRow[];
  selectedStore: StoreInfo | null;
  dispensaryLicense: string;
  onStartNew: () => void;
}

type Phase = 'pre-import' | 'generating' | 'uploading' | 'processing' | 'done' | 'error';

export function InventoryImportStep({
  derivedRows,
  selectedStore,
  dispensaryLicense,
  onStartNew,
}: InventoryImportStepProps) {
  const [phase, setPhase] = useState<Phase>('pre-import');
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [totalImported, setTotalImported] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelledRef = useRef(false);

  // Warn user before closing during import
  useEffect(() => {
    if (phase !== 'uploading' && phase !== 'processing') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const activeRows = useMemo(
    () => derivedRows.filter((r) => !r.excluded),
    [derivedRows],
  );

  // Determine which file roles contributed to this data
  const rolesUsed = useMemo(() => {
    const roles: string[] = ['Inventory'];
    if (activeRows.some((r) => r.invoiceId !== '')) roles.push('Receipts');
    if (activeRows.some((r) => r.distributorName !== '')) roles.push('Vendors');
    return roles;
  }, [activeRows]);

  // ── Get Token and URL ─────────────────────────────────────────────────────
  const getTokenAndUrl = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab?.url ?? '';
    const env = detectEnvironment(tabUrl);
    if (!env) throw new Error('Could not detect Treez environment from current page');

    const apiBaseUrl = getApiBaseUrl(env);
    const { token } = await sendMessage('getAuthToken', { appUrl: tabUrl });
    if (!token) throw new Error('No auth token available. Please refresh the Treez page and try again.');

    return { apiBaseUrl, token };
  }, []);

  // ── Run Import ────────────────────────────────────────────────────────────
  const handleStartImport = useCallback(async () => {
    if (!selectedStore) return;

    cancelledRef.current = false;
    setErrorMessage('');
    setProgressPercent(0);

    try {
      // Step 1: Generate CSV
      setPhase('generating');
      setStatusMessage('Generating 56-column inventory CSV...');

      const csvData = buildInventoryCSV(derivedRows);
      const dataRowCount = csvData.length - 1; // subtract header

      if (dataRowCount === 0) {
        setErrorMessage('No rows to import. All rows were excluded.');
        setPhase('error');
        return;
      }

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `CS Tool - Inventory Import - ${selectedStore.name} - ${ts}.csv`;

      // Step 2: Upload
      setPhase('uploading');
      setStatusMessage('Uploading to Treez...');
      setProgressPercent(25);

      const { apiBaseUrl, token } = await getTokenAndUrl();
      const { csvContent, contentLength } = buildUploadPayload(csvData, fileName);

      if (cancelledRef.current) return;

      const { presignedUrl } = await sendMessage('getPresignedUrl', {
        apiBaseUrl,
        token,
        params: {
          name: fileName,
          contentLength,
          objectType: 'INVENTORY_IMPORT',
          objectId: 'INVENTORY_IMPORT',
        },
      });

      if (cancelledRef.current) return;

      const uploadResult = await sendMessage('uploadToS3', {
        presignedUrl,
        csvContent,
        contentLength,
      });

      if (!uploadResult.ok) {
        throw new Error(uploadResult.error ?? 'S3 upload failed');
      }

      setProgressPercent(50);

      // Step 3: Poll for completion
      setPhase('processing');
      setStatusMessage('Processing import...');

      const interval = getAdaptiveInterval(dataRowCount);
      const pollStart = Date.now();
      let jobId: string | null = null;

      while (true) {
        if (cancelledRef.current) break;
        if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
          throw new Error('Import timed out after 60 minutes');
        }

        await new Promise((resolve) => setTimeout(resolve, interval));

        const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
        const jobs = await sendMessage('fetchImportReport', {
          apiBaseUrl: pollApiUrl,
          token: pollToken,
        });

        const job = jobId
          ? jobs.find((j: any) => j.id === jobId)
          : jobs.find((j: any) => j.name === fileName);

        if (job) {
          if (!jobId) jobId = job.id;

          // Update progress
          const jobProgress = job.totalRows && job.totalRows > 0
            ? job.countProcessed / job.totalRows
            : 0;
          setProgressPercent(50 + Math.round(jobProgress * 50));
          setStatusMessage(
            `Processing: ${job.countProcessed}/${job.totalRows ?? dataRowCount} rows`,
          );

          // Check for terminal status
          const allProcessed =
            job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

          if (isTerminalStatus(job.status) || allProcessed) {
            if (job.status === 'FINISHED' || allProcessed) {
              setTotalImported(job.countProcessed);
              setProgressPercent(100);
              setPhase('done');
              return;
            } else if (job.status === 'FINISHED_WITH_FAILURES') {
              setTotalImported(job.countProcessed - job.countError);
              setProgressPercent(100);
              setPhase('done');
              return;
            } else {
              throw new Error(`Import stopped: ${job.status} (${job.countError} errors)`);
            }
          }
        }
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setErrorMessage(err instanceof Error ? err.message : 'Import failed');
        setPhase('error');
      }
    }
  }, [derivedRows, selectedStore, getTokenAndUrl]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setShowCancelConfirm(false);
    setPhase('error');
    setErrorMessage('Import cancelled.');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <h2 className="mb-3 text-base font-semibold text-gray-900">
        {phase === 'done' ? 'Import Complete' : 'Import Inventory to Treez'}
      </h2>

      {selectedStore && (
        <p className="mb-3 text-xs text-gray-500">
          Store: {selectedStore.name}
        </p>
      )}

      {/* Warning during upload/processing */}
      {(phase === 'uploading' || phase === 'processing') && (
        <div className="mb-3 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-amber-800">
            Do not close this window until import finishes.
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 space-y-3 overflow-auto">
        {/* Pre-import state */}
        {phase === 'pre-import' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate and upload the 56-column inventory CSV to Treez.
            </p>

            <div className="rounded border border-gray-200 bg-white p-3 space-y-1">
              <p className="text-sm text-gray-700">
                <span className="font-medium">{activeRows.length.toLocaleString()}</span> rows ready for import
              </p>
              <p className="text-xs text-gray-500">
                {INVENTORY_OUTPUT_COLUMNS.length} columns | {rolesUsed.join(' + ')}
              </p>
              {dispensaryLicense && (
                <p className="text-xs text-gray-500">
                  License: {dispensaryLicense}
                </p>
              )}
            </div>

            {activeRows.length === 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-600">
                  No rows to import. All rows were excluded.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartImport}
              disabled={activeRows.length === 0}
              className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Import
            </button>
          </div>
        )}

        {/* Generating / Uploading / Processing -- single progress bar */}
        {(phase === 'generating' || phase === 'uploading' || phase === 'processing') && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <span className="text-sm text-gray-700">{statusMessage}</span>
            </div>

            <div className="h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-teal-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p className="text-center text-xs text-gray-500">
              {progressPercent}% complete
            </p>
          </div>
        )}

        {/* Done state */}
        {phase === 'done' && (
          <div className="space-y-3">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-center">
              <p className="text-sm font-medium text-green-800">
                Inventory import completed successfully
              </p>
              {totalImported > 0 && (
                <p className="text-xs text-green-600">
                  {totalImported.toLocaleString()} rows imported
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onStartNew}
              className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Start New Migration
            </button>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="space-y-3">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartImport}
                className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={onStartNew}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel button during import */}
      {(phase === 'uploading' || phase === 'processing') && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          {showCancelConfirm ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Cancel the current import?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Cancel Import
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel Import
            </button>
          )}
        </div>
      )}
    </div>
  );
}
