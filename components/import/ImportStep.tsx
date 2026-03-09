import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { buildOutputCSVs, generateZip } from '../../lib/csv-generator';
import { sendMessage } from '../../lib/messaging';
import { buildUploadPayload, getUploadSequence, API_OBJECT_TYPES } from '../../lib/file-uploader';
import { calculateETA, getAdaptiveInterval, isTerminalStatus, MAX_POLL_DURATION_MS } from '../../lib/import-poller';
import { detectEnvironment, getApiBaseUrl } from '../../lib/env';
import { ImportFileList } from './ImportFileList';
import type {
  DerivedRow,
  ParsedFile,
  FieldMapping,
  RowFix,
  ImportFileState,
  ImportObjectType,
  OutputCSVs,
} from '../../lib/types';
import { OUTPUT_FILE_ORDER, OUTPUT_FILE_LABELS } from '../../lib/types';

interface ImportStepProps {
  derivedRows: DerivedRow[];
  parsedFiles: ParsedFile[];
  mappings: FieldMapping[];
  fixes: RowFix[];
  onStartNew: () => void;
}

type Phase = 'pre-import' | 'downloading' | 'importing' | 'done' | 'error';

function buildInitialFileStates(csvs: OutputCSVs): ImportFileState[] {
  return OUTPUT_FILE_ORDER.map((key) => ({
    key,
    label: OUTPUT_FILE_LABELS[key],
    status: 'pending' as const,
    rowCount: Math.max(0, csvs[key].length - 1), // subtract header row
    processedCount: 0,
    errorCount: 0,
  }));
}

export function ImportStep({
  derivedRows,
  parsedFiles,
  mappings,
  fixes,
  onStartNew,
}: ImportStepProps) {
  const [phase, setPhase] = useState<Phase>('pre-import');
  const [zipReady, setZipReady] = useState(false);
  const [fileStates, setFileStates] = useState<ImportFileState[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [startTime, setStartTime] = useState(0);
  const [eta, setEta] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [failedFileIndex, setFailedFileIndex] = useState(-1);
  const [totalImported, setTotalImported] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const cancelledRef = useRef(false);
  const csvsRef = useRef<OutputCSVs | null>(null);

  // Warn user before closing during import
  useEffect(() => {
    if (phase !== 'importing') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── ZIP Download ──────────────────────────────────────────────────────────

  const handleDownloadZip = useCallback(async () => {
    setPhase('downloading');
    try {
      const activeRows = derivedRows.filter((r) => !r.excluded);
      const csvs = buildOutputCSVs(activeRows);
      csvsRef.current = csvs;
      const blob = await generateZip(csvs);
      // TEMPORARY: Remove when backend handles imports directly (Phase 4)
      saveAs(blob, 'treez-import.zip');
      setFileStates(buildInitialFileStates(csvs));
      setZipReady(true);
      setPhase('pre-import');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate ZIP');
      setPhase('error');
    }
  }, [derivedRows]);

  // ── Import Execution ──────────────────────────────────────────────────────

  const getTokenAndUrl = useCallback(async () => {
    // Detect environment from the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab?.url ?? '';
    const env = detectEnvironment(tabUrl);
    if (!env) throw new Error('Could not detect Treez environment from current page');

    const apiBaseUrl = getApiBaseUrl(env);
    const { token } = await sendMessage('getAuthToken', { appUrl: tabUrl });
    if (!token) throw new Error('No auth token available. Please refresh the Treez page and try again.');

    return { apiBaseUrl, token, appUrl: tabUrl };
  }, []);

  const runImport = useCallback(async (resumeFromIndex = 0) => {
    if (!csvsRef.current) return;
    const csvs = csvsRef.current;
    const sequence = getUploadSequence(csvs);

    cancelledRef.current = false;
    setPhase('importing');
    setStartTime(Date.now());
    setFailedFileIndex(-1);
    setErrorMessage('');

    // Build lookup: key -> sequence index
    const sequenceKeys = sequence.map((s) => s.key);

    for (let i = 0; i < fileStates.length; i++) {
      const fileKey = fileStates[i].key;
      const seqIdx = sequenceKeys.indexOf(fileKey);

      // Skip files not in sequence (empty) -- mark done
      if (seqIdx === -1) {
        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'done', processedCount: 0, rowCount: 0 } : f),
        );
        continue;
      }

      // Skip files already completed (for retry-from-failed)
      if (i < resumeFromIndex && fileStates[i].status === 'done') continue;

      if (cancelledRef.current) break;

      setCurrentFileIndex(i);
      const file = sequence[seqIdx];
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `${file.label} - ${ts}.csv`;

      try {
        // Re-acquire token for each file (handles expiry during long imports)
        const { apiBaseUrl, token } = await getTokenAndUrl();
        const objectType = API_OBJECT_TYPES[file.key];

        // 1. Build upload payload
        const { csvContent, contentLength } = buildUploadPayload(file.data, fileName);

        // 2. Mark as uploading
        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f),
        );

        // 3. Get presigned URL
        const { presignedUrl } = await sendMessage('getPresignedUrl', {
          apiBaseUrl,
          token,
          params: {
            name: fileName,
            contentLength,
            objectType,
            objectId: objectType,
          },
        });

        // 4. Upload to S3
        const uploadResult = await sendMessage('uploadToS3', {
          presignedUrl,
          csvContent,
          contentLength,
        });

        if (!uploadResult.ok) {
          throw new Error(uploadResult.error ?? 'S3 upload failed');
        }

        // 5. Mark as processing, begin polling
        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f),
        );

        // 6. Poll for completion
        const totalRows = file.data.length - 1; // subtract header
        const interval = getAdaptiveInterval(totalRows);
        const pollStart = Date.now();
        let jobId: string | null = null;

        while (true) {
          if (cancelledRef.current) break;
          if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
            throw new Error(`Import timed out after 60 minutes for ${file.label}`);
          }

          await new Promise((resolve) => setTimeout(resolve, interval));

          // Re-acquire token for polling (may expire during long imports)
          const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
          const jobs = await sendMessage('fetchImportReport', {
            apiBaseUrl: pollApiUrl,
            token: pollToken,
          });

          const job = jobId
            ? jobs.find((j) => j.id === jobId)
            : jobs.find((j) => j.name === fileName);

          if (job) {
            if (!jobId) jobId = job.id;

            // Update file state with progress
            setFileStates((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? {
                      ...f,
                      processedCount: job.countProcessed,
                      errorCount: job.countError,
                      rowCount: job.totalRows ?? f.rowCount,
                    }
                  : f,
              ),
            );

            // Update ETA
            const completedSoFar = fileStates.filter(
              (f, idx) => idx < i && (f.status === 'done' || f.status === 'done_with_warnings'),
            ).length;
            const fileProgress = job.totalRows
              ? job.countProcessed / job.totalRows
              : 0;
            setEta(calculateETA(startTime || Date.now(), completedSoFar, fileStates.length, fileProgress));

            // Check for terminal status
            const allProcessed =
              job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

            if (isTerminalStatus(job.status) || allProcessed) {
              if (job.status === 'FINISHED_WITH_FAILURES') {
                // Done with warnings -- continue to next file
                setFileStates((prev) =>
                  prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'done_with_warnings' } : f,
                  ),
                );
              } else if (job.status === 'FINISHED' || allProcessed) {
                setFileStates((prev) =>
                  prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'done' } : f,
                  ),
                );
              } else {
                // FINISHED_AND_STOPPED_EARLY or other terminal -- treat as failure
                throw new Error(
                  `Import stopped early for ${file.label}: ${job.status} (${job.countError} errors)`,
                );
              }
              break;
            }
          }
        }
      } catch (err) {
        if (cancelledRef.current) break;

        const msg = err instanceof Error ? err.message : 'Import failed';
        setFileStates((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'failed', error: msg } : f,
          ),
        );
        setFailedFileIndex(i);
        setErrorMessage(`${fileStates[i]?.label ?? 'File'} failed: ${msg}`);
        setPhase('error');
        return; // Stop sequence on failure
      }
    }

    if (!cancelledRef.current) {
      // Calculate total imported rows
      const total = fileStates.reduce((sum, f) => {
        if (f.status === 'done' || f.status === 'done_with_warnings') {
          return sum + f.processedCount;
        }
        return sum;
      }, 0);
      setTotalImported(total);
      setCurrentFileIndex(-1);
      setPhase('done');
    }
  }, [fileStates, getTokenAndUrl, startTime]);

  const handleStartImport = useCallback(() => {
    runImport(0);
  }, [runImport]);

  const handleRetry = useCallback(() => {
    if (failedFileIndex >= 0) {
      // Reset failed file to pending before retrying
      setFileStates((prev) =>
        prev.map((f, idx) =>
          idx >= failedFileIndex ? { ...f, status: 'pending', error: undefined, processedCount: 0, errorCount: 0 } : f,
        ),
      );
      runImport(failedFileIndex);
    }
  }, [failedFileIndex, runImport]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setShowCancelConfirm(false);
    setPhase('error');
    setErrorMessage('Import cancelled. Files already uploaded cannot be undone.');
  }, []);

  const handleDownloadAgain = useCallback(async () => {
    if (!csvsRef.current) return;
    const blob = await generateZip(csvsRef.current);
    saveAs(blob, 'treez-import.zip');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const failedFileLabel = failedFileIndex >= 0 ? fileStates[failedFileIndex]?.label : '';

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header */}
      <h2 className="mb-3 text-base font-semibold text-gray-900">
        {phase === 'done' ? 'Import Complete' : 'Import to Treez'}
      </h2>

      {/* Warning during import */}
      {phase === 'importing' && (
        <div className="mb-3 flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-amber-800">
            Do not close this window until all imports finish.
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 space-y-3 overflow-auto">
        {/* Pre-import: Generate & Download CSVs */}
        {phase === 'pre-import' && !zipReady && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generate the 6 import CSV files and download them as a ZIP archive.
              After downloading, you can start the import to upload files to Treez.
            </p>
            <button
              type="button"
              onClick={handleDownloadZip}
              className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Generate & Download CSVs
            </button>
          </div>
        )}

        {/* Downloading state */}
        {phase === 'downloading' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-teal-300 border-t-transparent" />
            <span className="text-sm text-gray-600">Generating CSV files...</span>
          </div>
        )}

        {/* Pre-import: ZIP ready, show Start Import */}
        {phase === 'pre-import' && zipReady && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 px-3 py-2">
              <svg className="h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">
                ZIP downloaded. Ready to import {fileStates.filter((f) => f.rowCount > 0).length} files to Treez.
              </span>
            </div>
            <button
              type="button"
              onClick={handleStartImport}
              className="w-full rounded-md bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
            >
              Start Import
            </button>
          </div>
        )}

        {/* Import in progress -- file list */}
        {(phase === 'importing' || phase === 'done') && (
          <ImportFileList
            files={fileStates}
            currentIndex={currentFileIndex}
            eta={eta}
          />
        )}

        {/* Done state */}
        {phase === 'done' && (
          <div className="space-y-3">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-center">
              <p className="text-sm font-medium text-green-800">
                All files imported successfully
              </p>
              {totalImported > 0 && (
                <p className="text-xs text-green-600">
                  {totalImported.toLocaleString()} total rows imported
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDownloadAgain}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download CSVs Again
              </button>
              <button
                type="button"
                onClick={onStartNew}
                className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Start New Migration
              </button>
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="space-y-3">
            {/* Show file list with error states */}
            {fileStates.length > 0 && (
              <ImportFileList
                files={fileStates}
                currentIndex={-1}
                eta=""
              />
            )}

            <div className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>

            <div className="flex gap-2">
              {failedFileIndex >= 0 && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 rounded-md bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Retry from {failedFileLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onStartNew}
                className={`rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
                  failedFileIndex >= 0 ? '' : 'flex-1'
                }`}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel button during import */}
      {phase === 'importing' && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          {showCancelConfirm ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                Files already uploaded cannot be undone. Cancel remaining files?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Continue Import
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
