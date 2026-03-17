import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import { buildOutputCSVs, generateZip } from '../../lib/csv-generator';
import { sendMessage } from '../../lib/messaging';
import { buildUploadPayload, getUploadSequence, API_OBJECT_TYPES } from '../../lib/file-uploader';
import { calculateETA, getAdaptiveInterval, isTerminalStatus, MAX_POLL_DURATION_MS } from '../../lib/import-poller';
import { detectEnvironment, getMsoApiBaseUrl } from '../../lib/env';
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
  selectedPOS?: string;
  onStartNew: () => void;
  onDone?: () => void;
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
  selectedPOS,
  onStartNew,
  onDone,
}: ImportStepProps) {
  const [phase, setPhase] = useState<Phase>('pre-import');
  const [fileStates, setFileStates] = useState<ImportFileState[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [startTime, setStartTime] = useState(0);
  const [eta, setEta] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [failedFileIndex, setFailedFileIndex] = useState(-1);
  const [totalImported, setTotalImported] = useState(0);

  const cancelledRef = useRef(false);
  const csvsRef = useRef<OutputCSVs | null>(null);

  // Warn user before closing during import
  useEffect(() => {
    if (phase !== 'importing') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  // ── Token & URL helper ────────────────────────────────────────────────────

  const getTokenAndUrl = useCallback(async () => {
    let tabUrl = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabUrl = tab?.url ?? '';
    } catch {
      tabUrl = window.location.href;
    }
    const env = detectEnvironment(tabUrl);
    if (!env) throw new Error('Could not detect Treez environment from current page');

    const apiBaseUrl = getMsoApiBaseUrl(env);
    const { token } = await sendMessage('getAuthToken', { appUrl: tabUrl });
    if (!token) throw new Error('No auth token available. Please refresh the Treez page and try again.');

    return { apiBaseUrl, token, appUrl: tabUrl };
  }, []);

  // ── Import Execution ──────────────────────────────────────────────────────

  const runImport = useCallback(async (resumeFromIndex = 0) => {
    if (!csvsRef.current) return;
    const csvs = csvsRef.current;
    const sequence = getUploadSequence(csvs);

    cancelledRef.current = false;
    setPhase('importing');
    setStartTime(Date.now());
    setFailedFileIndex(-1);
    setErrorMessage('');

    const sequenceKeys = sequence.map((s) => s.key);

    for (let i = 0; i < fileStates.length; i++) {
      const fileKey = fileStates[i].key;
      const seqIdx = sequenceKeys.indexOf(fileKey);

      if (seqIdx === -1) {
        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'done', processedCount: 0, rowCount: 0 } : f),
        );
        continue;
      }

      if (i < resumeFromIndex && fileStates[i].status === 'done') continue;
      if (cancelledRef.current) break;

      setCurrentFileIndex(i);
      const file = sequence[seqIdx];
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `${file.label} - ${ts}.csv`;

      try {
        const { apiBaseUrl, token } = await getTokenAndUrl();
        const objectType = API_OBJECT_TYPES[file.key];
        const { csvContent, contentLength } = buildUploadPayload(file.data, fileName);

        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f),
        );

        const { presignedUrl } = await sendMessage('getPresignedUrl', {
          apiBaseUrl, token,
          params: { name: fileName, contentLength, objectType, objectId: objectType },
        });

        const uploadResult = await sendMessage('uploadToS3', { presignedUrl, csvContent, contentLength });
        if (!uploadResult.ok) throw new Error(uploadResult.error ?? 'S3 upload failed');

        setFileStates((prev) =>
          prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f),
        );

        const totalRows = file.data.length - 1;
        const interval = getAdaptiveInterval(totalRows);
        const pollStart = Date.now();
        let jobId: string | null = null;

        while (true) {
          if (cancelledRef.current) break;
          if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
            throw new Error(`Import timed out after 60 minutes for ${file.label}`);
          }

          await new Promise((resolve) => setTimeout(resolve, interval));

          const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
          const jobs = await sendMessage('fetchImportReport', { apiBaseUrl: pollApiUrl, token: pollToken });

          const job: any = jobId ? jobs.find((j) => j.id === jobId) : jobs.find((j) => j.name === fileName);

          if (job) {
            if (!jobId) jobId = job.id;

            setFileStates((prev) =>
              prev.map((f, idx) =>
                idx === i
                  ? { ...f, processedCount: job.countProcessed, errorCount: job.countError, rowCount: job.totalRows ?? f.rowCount }
                  : f,
              ),
            );

            const completedSoFar = fileStates.filter(
              (f, idx) => idx < i && (f.status === 'done' || f.status === 'done_with_warnings'),
            ).length;
            const fileProgress = job.totalRows ? job.countProcessed / job.totalRows : 0;
            setEta(calculateETA(startTime || Date.now(), completedSoFar, fileStates.length, fileProgress));

            const allProcessed = job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

            if (isTerminalStatus(job.status) || allProcessed) {
              if (job.status === 'FINISHED_WITH_FAILURES') {
                setFileStates((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done_with_warnings' } : f));
              } else if (job.status === 'FINISHED' || allProcessed) {
                setFileStates((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'done' } : f));
              } else {
                throw new Error(`Import stopped early for ${file.label}: ${job.status} (${job.countError} errors)`);
              }
              break;
            }
          }
        }
      } catch (err) {
        if (cancelledRef.current) break;
        const msg = err instanceof Error ? err.message : 'Import failed';
        setFileStates((prev) => prev.map((f, idx) => idx === i ? { ...f, status: 'failed', error: msg } : f));
        setFailedFileIndex(i);
        setErrorMessage(`${fileStates[i]?.label ?? 'File'} failed: ${msg}`);
        setPhase('error');
        return;
      }
    }

    if (!cancelledRef.current) {
      const total = fileStates.reduce((sum, f) => {
        if (f.status === 'done' || f.status === 'done_with_warnings') return sum + f.processedCount;
        return sum;
      }, 0);
      setTotalImported(total);
      setCurrentFileIndex(-1);
      setPhase('done');
      onDone?.();
    }
  }, [fileStates, getTokenAndUrl, startTime]);

  // ── Start Import: generate CSVs, download ZIP, then run import ──────────

  const handleStartImport = useCallback(async () => {
    setPhase('downloading');
    try {
      const activeRows = derivedRows.filter((r) => !r.excluded);
      const csvs = buildOutputCSVs(activeRows, selectedPOS);
      csvsRef.current = csvs;
      const blob = await generateZip(csvs);
      saveAs(blob, 'treez-import.zip');
      const states = buildInitialFileStates(csvs);
      setFileStates(states);

      // Immediately start import after download
      cancelledRef.current = false;
      setPhase('importing');
      setStartTime(Date.now());
      setFailedFileIndex(-1);
      setErrorMessage('');

      const sequence = getUploadSequence(csvs);
      const sequenceKeys = sequence.map((s) => s.key);

      for (let i = 0; i < states.length; i++) {
        const fileKey = states[i].key;
        const seqIdx = sequenceKeys.indexOf(fileKey);

        if (seqIdx === -1) {
          states[i] = { ...states[i], status: 'done', processedCount: 0, rowCount: 0 };
          setFileStates([...states]);
          continue;
        }

        if (cancelledRef.current) break;

        setCurrentFileIndex(i);
        const file = sequence[seqIdx];
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
        const fileName = `${file.label} - ${ts}.csv`;

        try {
          const { apiBaseUrl, token } = await getTokenAndUrl();
          const objectType = API_OBJECT_TYPES[file.key];
          const { csvContent, contentLength } = buildUploadPayload(file.data, fileName);

          states[i] = { ...states[i], status: 'uploading' };
          setFileStates([...states]);

          const { presignedUrl } = await sendMessage('getPresignedUrl', {
            apiBaseUrl, token,
            params: { name: fileName, contentLength, objectType, objectId: objectType },
          });

          const uploadResult = await sendMessage('uploadToS3', { presignedUrl, csvContent, contentLength });
          if (!uploadResult.ok) throw new Error(uploadResult.error ?? 'S3 upload failed');

          states[i] = { ...states[i], status: 'processing' };
          setFileStates([...states]);

          const totalRows = file.data.length - 1;
          const interval = getAdaptiveInterval(totalRows);
          const pollStart = Date.now();
          let jobId: string | null = null;

          while (true) {
            if (cancelledRef.current) break;
            if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
              throw new Error(`Import timed out after 60 minutes for ${file.label}`);
            }

            await new Promise((resolve) => setTimeout(resolve, interval));

            const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
            const jobs = await sendMessage('fetchImportReport', { apiBaseUrl: pollApiUrl, token: pollToken });
            const job: any = jobId ? jobs.find((j) => j.id === jobId) : jobs.find((j) => j.name === fileName);

            if (job) {
              if (!jobId) jobId = job.id;
              states[i] = { ...states[i], processedCount: job.countProcessed, errorCount: job.countError, rowCount: job.totalRows ?? states[i].rowCount };
              setFileStates([...states]);

              const allProcessed = job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

              if (isTerminalStatus(job.status) || allProcessed) {
                if (job.status === 'FINISHED_WITH_FAILURES') {
                  states[i] = { ...states[i], status: 'done_with_warnings' };
                } else if (job.status === 'FINISHED' || allProcessed) {
                  states[i] = { ...states[i], status: 'done' };
                } else {
                  throw new Error(`Import stopped early for ${file.label}: ${job.status} (${job.countError} errors)`);
                }
                setFileStates([...states]);
                break;
              }
            }
          }
        } catch (err) {
          if (cancelledRef.current) break;
          const msg = err instanceof Error ? err.message : 'Import failed';
          states[i] = { ...states[i], status: 'failed', error: msg };
          setFileStates([...states]);
          setFailedFileIndex(i);
          setErrorMessage(`${states[i]?.label ?? 'File'} failed: ${msg}`);
          setPhase('error');
          return;
        }
      }

      if (!cancelledRef.current) {
        const total = states.reduce((sum, f) => {
          if (f.status === 'done' || f.status === 'done_with_warnings') return sum + f.processedCount;
          return sum;
        }, 0);
        setTotalImported(total);
        setCurrentFileIndex(-1);
        setPhase('done');
      onDone?.();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate CSV files');
      setPhase('error');
    }
  }, [derivedRows, getTokenAndUrl]);

  const handleRetry = useCallback(() => {
    if (failedFileIndex >= 0) {
      setFileStates((prev) =>
        prev.map((f, idx) =>
          idx >= failedFileIndex ? { ...f, status: 'pending', error: undefined, processedCount: 0, errorCount: 0 } : f,
        ),
      );
      runImport(failedFileIndex);
    }
  }, [failedFileIndex, runImport]);

  const handleDownloadAgain = useCallback(async () => {
    if (!csvsRef.current) return;
    const blob = await generateZip(csvsRef.current);
    saveAs(blob, 'treez-import.zip');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const failedFileLabel = failedFileIndex >= 0 ? fileStates[failedFileIndex]?.label : '';

  return (
    <div className="flex h-full w-full flex-col p-4">
      {/* Header */}
      <h2 className="mb-3 text-sm font-medium text-gray-900">
        {phase === 'done' ? 'Import Complete' : 'Import to Treez'}
      </h2>

      {/* Warning during import */}
      {phase === 'importing' && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
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
        {/* Pre-import: Start Import button */}
        {phase === 'pre-import' && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-600">
              This will generate 6 import CSV files, download them as a ZIP archive, and start uploading to Treez.
            </p>
            {derivedRows.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-sm text-amber-700">
                  No data available. Please go back to the Review step to regenerate.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleStartImport}
              disabled={derivedRows.length === 0}
              className="btn-treez-green font-[Roboto,sans-serif] font-medium disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                padding: '0 20px',
                borderRadius: '15px',
                border: 'none',
                color: '#0f1709',
                fontSize: '14px',
                height: '40px',
                letterSpacing: '0.4px',
                lineHeight: '24px',
              }}
            >
              Start Import
            </button>
          </div>
        )}

        {/* Downloading/generating state */}
        {phase === 'downloading' && (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-treez-accent border-t-transparent" />
            <span className="text-sm text-gray-600">Generating CSV files...</span>
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
            <div className="rounded-lg border border-treez-accent bg-treez-accent-muted px-3 py-2 text-center">
              <p className="text-sm font-medium text-treez-primary">
                All files imported successfully
              </p>
              {totalImported > 0 && (
                <p className="text-xs text-treez-text-secondary">
                  {totalImported.toLocaleString()} total rows imported
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="space-y-3">
            {fileStates.length > 0 && (
              <ImportFileList files={fileStates} currentIndex={-1} eta="" />
            )}

            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>

            <div className="flex gap-2">
              {failedFileIndex >= 0 && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="btn-treez-green flex-1 font-[Roboto,sans-serif] font-medium"
                  style={{ padding: '0 20px', borderRadius: '15px', border: 'none', color: '#0f1709', fontSize: '14px', height: '40px' }}
                >
                  Retry from {failedFileLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onStartNew}
                className={`btn-treez-text font-[Roboto,sans-serif] font-medium ${failedFileIndex >= 0 ? '' : 'flex-1'}`}
                style={{ padding: '8px 10px', borderRadius: '16px', border: 'none', color: '#1a4007', fontSize: '15px', height: '40px' }}
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
