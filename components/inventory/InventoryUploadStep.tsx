import { useCallback, useState } from 'react';
import type { ParsedFile, POSDetectionResult, StoreInfo } from '../../lib/types';
import { validateFile, parseFile, getSheetNames } from '../../lib/parser';
import { detectPOS } from '../../lib/pos-detection';
import { FileDropZone } from '../upload/FileDropZone';
import { FileSummaryCard } from '../upload/FileSummaryCard';
import { SheetSelector, getDefaultSheet } from '../upload/SheetSelector';

type ParsingStatus = 'idle' | 'parsing' | 'done' | 'error';

interface InventoryUploadStepProps {
  onCanProceed: (canProceed: boolean) => void;
  parsedFiles: ParsedFile[];
  onParsedFilesChange: (files: ParsedFile[]) => void;
  selectedPOS: string;
  onSelectedPOSChange: (pos: string) => void;
  detectedPOS: POSDetectionResult | null;
  onDetectedPOSChange: (result: POSDetectionResult) => void;
  selectedStore: StoreInfo | null;
}

interface PendingSheet {
  file: File;
  sheets: string[];
  selectedSheet: string;
}

export function InventoryUploadStep({
  onCanProceed,
  parsedFiles,
  onParsedFilesChange,
  selectedPOS,
  onSelectedPOSChange,
  detectedPOS,
  onDetectedPOSChange,
  selectedStore,
}: InventoryUploadStepProps) {
  const [status, setStatus] = useState<ParsingStatus>(
    parsedFiles.length > 0 ? 'done' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [pendingSheet, setPendingSheet] = useState<PendingSheet | null>(null);

  const updateCanProceed = useCallback(
    (files: ParsedFile[], pos: string) => {
      onCanProceed(files.length > 0 && pos !== '' && selectedStore !== null);
    },
    [onCanProceed, selectedStore],
  );

  const runDetection = useCallback(
    (files: ParsedFile[]) => {
      const result = detectPOS(files);
      onDetectedPOSChange(result);
      if (result.detected && !selectedPOS) {
        onSelectedPOSChange(result.detected);
      }
      const posReady = !!(result.detected || selectedPOS);
      const effectivePOS = result.detected || selectedPOS;
      onCanProceed(
        files.length > 0 && posReady && selectedStore !== null,
      );
    },
    [onDetectedPOSChange, onSelectedPOSChange, onCanProceed, selectedPOS, selectedStore],
  );

  const handleFilesSelected = useCallback(
    async (rawFiles: File[]) => {
      setError(null);

      for (const file of rawFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(`${file.name}: ${validationError}`);
          return;
        }
      }

      // Check for multi-sheet XLSX
      if (rawFiles.length === 1) {
        const file = rawFiles[0];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
          const sheets = await getSheetNames(file);
          if (sheets.length > 1) {
            const defaultSheet = getDefaultSheet(sheets);
            setPendingSheet({ file, sheets, selectedSheet: defaultSheet });
            return;
          }
        }
      }

      await parseFiles(rawFiles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsedFiles],
  );

  const parseFiles = useCallback(
    async (rawFiles: File[], sheetName?: string) => {
      setStatus('parsing');
      setProgress({ current: 0, total: rawFiles.length });

      try {
        const newParsed: ParsedFile[] = [];
        for (let i = 0; i < rawFiles.length; i++) {
          setProgress({ current: i + 1, total: rawFiles.length });
          const parsed = await parseFile(rawFiles[i], sheetName);
          newParsed.push(parsed);
        }

        const allFiles = [...parsedFiles, ...newParsed];
        onParsedFilesChange(allFiles);
        setStatus('done');
        setPendingSheet(null);
        runDetection(allFiles);
      } catch (err) {
        setStatus('error');
        setError(
          err instanceof Error ? err.message : 'Failed to parse file(s)',
        );
      }
    },
    [parsedFiles, onParsedFilesChange, runDetection],
  );

  const handleSheetConfirm = useCallback(() => {
    if (!pendingSheet) return;
    parseFiles([pendingSheet.file], pendingSheet.selectedSheet);
  }, [pendingSheet, parseFiles]);

  const handleRemoveFile = useCallback(
    (fileName: string) => {
      const updated = parsedFiles.filter((f) => f.fileName !== fileName);
      onParsedFilesChange(updated);
      if (updated.length === 0) {
        setStatus('idle');
        onCanProceed(false);
        onDetectedPOSChange({ detected: null, confidence: 0, disagreement: false });
      } else {
        runDetection(updated);
      }
    },
    [parsedFiles, onParsedFilesChange, onCanProceed, onDetectedPOSChange, runDetection],
  );

  const handleChangeFile = useCallback(() => {
    onParsedFilesChange([]);
    setStatus('idle');
    setError(null);
    setPendingSheet(null);
    onCanProceed(false);
  }, [onParsedFilesChange, onCanProceed]);

  const handlePOSChange = useCallback(
    (pos: string) => {
      onSelectedPOSChange(pos);
      onCanProceed(parsedFiles.length > 0 && pos !== '' && selectedStore !== null);
    },
    [parsedFiles, selectedStore, onSelectedPOSChange, onCanProceed],
  );

  return (
    <div className="w-full space-y-4 p-4">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Upload Inventory Files</h2>
        <p className="mt-1 text-xs text-gray-500">
          Upload your POS inventory export files (CSV or XLSX) to get started.
        </p>
      </div>

      {/* Store gate warning */}
      {!selectedStore && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            Please select a store above before uploading files.
          </p>
        </div>
      )}

      {/* Drop zone */}
      <FileDropZone
        onFilesSelected={handleFilesSelected}
        disabled={status === 'parsing' || !selectedStore}
      />

      {/* Parsing progress */}
      {status === 'parsing' && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
            <span className="text-sm text-gray-600">
              Parsing file {progress.current} of {progress.total}...
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-gray-200">
            <div
              className="h-1.5 rounded-full bg-teal-600 transition-all"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Sheet selector for multi-sheet XLSX */}
      {pendingSheet && (
        <div className="space-y-2">
          <SheetSelector
            sheets={pendingSheet.sheets}
            selected={pendingSheet.selectedSheet}
            onSelect={(sheet) =>
              setPendingSheet({ ...pendingSheet, selectedSheet: sheet })
            }
          />
          <button
            type="button"
            onClick={handleSheetConfirm}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Parse selected sheet
          </button>
        </div>
      )}

      {/* File summary cards */}
      {parsedFiles.length > 0 && status === 'done' && (
        <div className="space-y-3">
          {parsedFiles.map((file, idx) => (
            <FileSummaryCard
              key={file.fileName}
              file={file}
              detectedPOS={detectedPOS}
              selectedPOS={selectedPOS}
              onSelectedPOSChange={handlePOSChange}
              onRemoveFile={handleRemoveFile}
              onChangeFile={handleChangeFile}
              showPOS={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
