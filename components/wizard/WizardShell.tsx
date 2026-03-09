import { useCallback, useEffect, useRef, useState } from 'react';
import { STEP_LABELS } from '../../lib/constants';
import { StepIndicator } from './StepIndicator';
import { StepPlaceholder } from './StepPlaceholder';
import { UploadStep } from '../upload/UploadStep';
import { MappingStep } from '../mapping/MappingStep';
import { ReviewStep } from '../review/ReviewStep';
import { mergeFiles } from '../../lib/parser';
import { applyPOSDefaults } from '../../lib/mapping-engine';
import {
  saveMigrationState,
  loadMigrationState,
} from '../../lib/migration-store';
import type {
  ParsedFile,
  FieldMapping,
  DerivedRow,
  RowFix,
  POSDetectionResult,
} from '../../lib/types';

interface WizardShellProps {
  wizardType: 'catalog' | 'inventory';
}

export function WizardShell({ wizardType }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [mergedFile, setMergedFile] = useState<ParsedFile | null>(null);
  const [selectedPOS, setSelectedPOS] = useState('');
  const [detectedPOS, setDetectedPOS] = useState<POSDetectionResult | null>(
    null,
  );
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [fixes, setFixes] = useState<RowFix[]>([]);
  const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
  const [canProceed, setCanProceed] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [restored, setRestored] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title =
    wizardType === 'catalog' ? 'Migrate Catalog' : 'Migrate Inventory';
  const lastStep = STEP_LABELS.length - 1;

  // ── Restore persisted state on mount ────────────────────────────────────
  useEffect(() => {
    loadMigrationState().then((saved) => {
      if (saved) {
        setParsedFiles(saved.parsedFiles);
        setSelectedPOS(saved.selectedPOS);
        setMappings(saved.mappings);
        setFixes(saved.fixes ?? []);
        setCurrentStep(saved.currentStep);
        if (saved.parsedFiles.length > 0) {
          setMergedFile(mergeFiles(saved.parsedFiles));
          setCanProceed(
            saved.parsedFiles.length > 0 && saved.selectedPOS !== '',
          );
        }
      }
      setRestored(true);
    });
  }, []);

  // ── Debounced persistence on state changes ──────────────────────────────
  useEffect(() => {
    if (!restored) return; // Don't save during restore

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMigrationState({
        parsedFiles,
        mergedHeaders: mergedFile?.headers ?? [],
        selectedPOS,
        mappings,
        fixes,
        currentStep,
        updatedAt: new Date().toISOString(),
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [parsedFiles, mergedFile, selectedPOS, mappings, fixes, currentStep, restored]);

  // ── Re-merge when files change ──────────────────────────────────────────
  const handleParsedFilesChange = useCallback((files: ParsedFile[]) => {
    setParsedFiles(files);
    if (files.length > 0) {
      setMergedFile(mergeFiles(files));
    } else {
      setMergedFile(null);
    }
  }, []);

  // ── Re-apply POS defaults when POS changes ─────────────────────────────
  const handleSelectedPOSChange = useCallback(
    (pos: string) => {
      setSelectedPOS(pos);
      // Only auto-apply POS defaults if all mappings are currently empty
      // (i.e., user hasn't manually edited any mapping yet)
      const allEmpty = mappings.every((m) => m.sourceHeader === null);
      if (allEmpty || mappings.length === 0) {
        setMappings(applyPOSDefaults(pos));
      }
    },
    [mappings],
  );

  // ── Next button label ─────────────────────────────────────────────────
  const nextButtonLabel = (() => {
    if (currentStep === 2 && warningCount > 0 && canProceed) {
      return `Import with ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
    }
    return 'Next';
  })();

  // ── Render step content ─────────────────────────────────────────────────
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <UploadStep
            onCanProceed={setCanProceed}
            parsedFiles={parsedFiles}
            onParsedFilesChange={handleParsedFilesChange}
            selectedPOS={selectedPOS}
            onSelectedPOSChange={handleSelectedPOSChange}
            detectedPOS={detectedPOS}
            onDetectedPOSChange={setDetectedPOS}
          />
        );
      case 1:
        return mergedFile ? (
          <MappingStep
            mappings={mappings}
            onMappingsChange={setMappings}
            mergedFile={mergedFile}
            selectedPOS={selectedPOS}
            onCanProceed={setCanProceed}
          />
        ) : (
          <StepPlaceholder stepName={STEP_LABELS[currentStep]} />
        );
      case 2:
        return (
          <ReviewStep
            parsedFiles={parsedFiles}
            mappings={mappings}
            onCanProceed={setCanProceed}
            onDerivedRowsChange={setDerivedRows}
            onFixesChange={setFixes}
            onWarningCountChange={setWarningCount}
            fixes={fixes}
          />
        );
      default:
        return <StepPlaceholder stepName={STEP_LABELS[currentStep]} />;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <h1 className="px-4 pt-4 text-lg font-semibold text-gray-900">
          {title}
        </h1>
        <StepIndicator steps={[...STEP_LABELS]} current={currentStep} />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-auto bg-gray-50">
        {renderStep()}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          disabled={currentStep === 0}
          onClick={() => setCurrentStep((s) => s - 1)}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          disabled={currentStep === lastStep || !canProceed}
          onClick={() => setCurrentStep((s) => s + 1)}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextButtonLabel}
        </button>
      </div>
    </div>
  );
}
