import { useCallback, useEffect, useRef, useState } from 'react';
import { STEP_LABELS } from '../../lib/constants';
import { StepIndicator } from './StepIndicator';
import { StepPlaceholder } from './StepPlaceholder';
import { UploadStep } from '../upload/UploadStep';
import { MappingStep } from '../mapping/MappingStep';
import { ReviewStep } from '../review/ReviewStep';
import { ImportStep } from '../import/ImportStep';
import { StoreSelector } from '../inventory/StoreSelector';
import { InventoryUploadStep } from '../inventory/InventoryUploadStep';
import { InventoryMappingStep } from '../inventory/InventoryMappingStep';
import { InventoryReviewStep } from '../inventory/InventoryReviewStep';
import { InventoryImportStep } from '../inventory/InventoryImportStep';
import { mergeFiles } from '../../lib/parser';
import { applyPOSDefaults } from '../../lib/mapping-engine';
import {
  saveMigrationState,
  loadMigrationState,
  clearMigrationState,
} from '../../lib/migration-store';
import {
  saveInventoryState,
  loadInventoryState,
  clearInventoryState,
} from '../../lib/inventory-migration-store';
import {
  createEmptyInventoryMappings,
  INVENTORY_POS_DEFAULTS,
  INVENTORY_MAPPING_FIELDS,
  INVENTORY_ROLE_POS_DEFAULTS,
  INVENTORY_ROLE_FIELDS,
} from '../../lib/inventory-constants';
import { extractStoreClaimsFromToken, getMsoApiBaseUrl } from '../../lib/store-api';
import { sendMessage } from '../../lib/messaging';
import { detectEnvironment } from '../../lib/env';
import type { PerRoleMappings } from '../../lib/inventory-transformer';
import type {
  ParsedFile,
  FieldMapping,
  DerivedRow,
  RowFix,
  POSDetectionResult,
  StoreInfo,
  InventoryDerivedRow,
  InventoryFileAssignment,
  InventoryFileRole,
  PerRoleMappingsState,
} from '../../lib/types';

interface WizardShellProps {
  wizardType: 'catalog' | 'inventory';
}

const EMPTY_PER_ROLE_MAPPINGS: PerRoleMappingsState = {
  inventory: [],
  receipts: [],
  vendors: [],
  adjustments: [],
  catalog_export: [],
};

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

  // ── Inventory-specific state ────────────────────────────────────────────
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [inventoryDerivedRows, setInventoryDerivedRows] = useState<InventoryDerivedRow[]>([]);
  const [fileAssignments, setFileAssignments] = useState<InventoryFileAssignment[]>([]);
  const [dispensaryLicense, setDispensaryLicense] = useState('');
  const [perRoleMappings, setPerRoleMappings] = useState<PerRoleMappingsState>(
    { ...EMPTY_PER_ROLE_MAPPINGS },
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title =
    wizardType === 'catalog' ? 'Migrate Catalog' : 'Migrate Inventory';
  const lastStep = STEP_LABELS.length - 1;

  // ── Fetch stores on mount (inventory mode only) ─────────────────────────
  useEffect(() => {
    if (wizardType !== 'inventory') return;

    let cancelled = false;
    setStoresLoading(true);
    setStoresError(null);

    (async () => {
      try {
        // Get auth token from current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabUrl = tab?.url ?? '';
        const { token } = await sendMessage('getAuthToken', { appUrl: tabUrl });
        if (!token) {
          throw new Error('No auth token available. Please refresh the Treez page.');
        }

        // Extract org/entity claims from JWT
        const claims = extractStoreClaimsFromToken(token);
        if (!claims) {
          throw new Error('Could not extract store claims from token. JWT may be missing required fields.');
        }

        // Detect environment for MSO API URL
        const env = detectEnvironment(tabUrl);
        if (!env) {
          throw new Error('Could not detect Treez environment from current page.');
        }

        const apiBaseUrl = getMsoApiBaseUrl(env);
        const storeList = await sendMessage('fetchStores', {
          apiBaseUrl,
          token,
          orgId: claims.orgId,
          entityIds: claims.entityIds,
        });

        if (!cancelled) {
          setStores(storeList);
          setStoresLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setStoresError(err instanceof Error ? err.message : 'Failed to fetch stores');
          setStoresLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [wizardType]);

  // ── Restore persisted state on mount ────────────────────────────────────
  useEffect(() => {
    if (wizardType === 'inventory') {
      loadInventoryState().then((saved) => {
        if (saved) {
          setParsedFiles(saved.parsedFiles);
          setSelectedPOS(saved.selectedPOS);
          setMappings(saved.mappings);
          setFixes(saved.fixes ?? []);
          setCurrentStep(saved.currentStep);
          setSelectedStore(saved.selectedStore);
          setFileAssignments(saved.fileAssignments ?? []);
          setDispensaryLicense(saved.dispensaryLicense ?? '');
          if (saved.perRoleMappings) {
            setPerRoleMappings(saved.perRoleMappings);
          }
          if (saved.parsedFiles.length > 0) {
            setMergedFile(mergeFiles(saved.parsedFiles));
            setCanProceed(
              saved.parsedFiles.length > 0 &&
              saved.selectedPOS !== '' &&
              saved.selectedStore !== null,
            );
          }
        }
        setRestored(true);
      });
    } else {
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
    }
  }, [wizardType]);

  // ── Reset wizard when the active tab refreshes/navigates ────────────────
  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.tabRefreshedAt) {
        clearMigrationState();
        clearInventoryState();
        setParsedFiles([]);
        setMergedFile(null);
        setSelectedPOS('');
        setDetectedPOS(null);
        setMappings([]);
        setFixes([]);
        setDerivedRows([]);
        setInventoryDerivedRows([]);
        setSelectedStore(null);
        setFileAssignments([]);
        setDispensaryLicense('');
        setPerRoleMappings({ ...EMPTY_PER_ROLE_MAPPINGS });
        setCanProceed(false);
        setWarningCount(0);
        setCurrentStep(0);
      }
    };

    chrome.storage.session.onChanged.addListener(handler);
    return () => chrome.storage.session.onChanged.removeListener(handler);
  }, []);

  // ── Debounced persistence on state changes ──────────────────────────────
  useEffect(() => {
    if (!restored) return; // Don't save during restore

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (wizardType === 'inventory') {
        saveInventoryState({
          parsedFiles,
          mergedHeaders: mergedFile?.headers ?? [],
          selectedPOS,
          selectedStore,
          mappings,
          perRoleMappings,
          fixes,
          currentStep,
          updatedAt: new Date().toISOString(),
          fileAssignments,
          dispensaryLicense,
        });
      } else {
        saveMigrationState({
          parsedFiles,
          mergedHeaders: mergedFile?.headers ?? [],
          selectedPOS,
          mappings,
          fixes,
          currentStep,
          updatedAt: new Date().toISOString(),
        });
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [parsedFiles, mergedFile, selectedPOS, selectedStore, mappings, perRoleMappings, fixes, currentStep, restored, wizardType, fileAssignments, dispensaryLicense]);

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
      const allEmpty = mappings.every((m) => m.sourceHeader === null);
      if (allEmpty || mappings.length === 0) {
        if (wizardType === 'inventory') {
          const defaults = INVENTORY_POS_DEFAULTS[pos];
          setMappings(
            INVENTORY_MAPPING_FIELDS.map((field) => ({
              fieldKey: field.key,
              label: field.label,
              sourceHeader: defaults?.[field.key] ?? null,
            })),
          );
        } else {
          setMappings(applyPOSDefaults(pos));
        }
      }

      // Auto-apply per-role POS defaults if all per-role mappings are empty
      if (wizardType === 'inventory') {
        const allPerRoleEmpty = Object.values(perRoleMappings).every(
          (roleMappings: FieldMapping[]) => roleMappings.length === 0 || roleMappings.every((m: FieldMapping) => m.sourceHeader === null),
        );
        if (allPerRoleEmpty) {
          const posDefaults = INVENTORY_ROLE_POS_DEFAULTS[pos];
          if (posDefaults) {
            const newPerRole: PerRoleMappingsState = { ...EMPTY_PER_ROLE_MAPPINGS };
            for (const role of Object.keys(INVENTORY_ROLE_FIELDS) as InventoryFileRole[]) {
              const roleDefaults = posDefaults[role] ?? {};
              newPerRole[role] = (INVENTORY_ROLE_FIELDS[role] ?? []).map((field) => ({
                fieldKey: field.key,
                label: field.label,
                sourceHeader: roleDefaults[field.key] ?? null,
              }));
            }
            setPerRoleMappings(newPerRole);
          }
        }
      }
    },
    [mappings, wizardType, perRoleMappings],
  );

  // ── Store change handler (inventory mode) ──────────────────────────────
  const handleStoreChange = useCallback(
    (store: StoreInfo | null) => {
      setSelectedStore(store);
      // Reset wizard state on store change
      setParsedFiles([]);
      setMergedFile(null);
      setSelectedPOS('');
      setDetectedPOS(null);
      setMappings([]);
      setFixes([]);
      setInventoryDerivedRows([]);
      setFileAssignments([]);
      setDispensaryLicense('');
      setPerRoleMappings({ ...EMPTY_PER_ROLE_MAPPINGS });
      setCanProceed(false);
      setWarningCount(0);
      setCurrentStep(0);
    },
    [],
  );

  // ── Start New Migration (clears all state, resets wizard) ──────────────
  const handleStartNew = useCallback(async () => {
    if (wizardType === 'inventory') {
      await clearInventoryState();
    } else {
      await clearMigrationState();
    }
    setParsedFiles([]);
    setMergedFile(null);
    setSelectedPOS('');
    setDetectedPOS(null);
    setMappings([]);
    setFixes([]);
    setDerivedRows([]);
    setInventoryDerivedRows([]);
    setSelectedStore(null);
    setFileAssignments([]);
    setDispensaryLicense('');
    setPerRoleMappings({ ...EMPTY_PER_ROLE_MAPPINGS });
    setCanProceed(false);
    setWarningCount(0);
    setCurrentStep(0);
  }, [wizardType]);

  // ── Next button label ─────────────────────────────────────────────────
  const nextButtonLabel = (() => {
    if (currentStep === 2 && warningCount > 0 && canProceed) {
      return `Import with ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
    }
    return 'Next';
  })();

  // ── Render step content ─────────────────────────────────────────────────
  const renderStep = () => {
    // Inventory branch
    if (wizardType === 'inventory') {
      switch (currentStep) {
        case 0:
          return (
            <InventoryUploadStep
              onCanProceed={setCanProceed}
              parsedFiles={parsedFiles}
              onParsedFilesChange={handleParsedFilesChange}
              fileAssignments={fileAssignments}
              onFileAssignmentsChange={setFileAssignments}
              selectedPOS={selectedPOS}
              onSelectedPOSChange={handleSelectedPOSChange}
              detectedPOS={detectedPOS}
              onDetectedPOSChange={setDetectedPOS}
              selectedStore={selectedStore}
              dispensaryLicense={dispensaryLicense}
              onDispensaryLicenseChange={setDispensaryLicense}
            />
          );
        case 1:
          return (
            <InventoryMappingStep
              fileAssignments={fileAssignments}
              perRoleMappings={perRoleMappings as PerRoleMappings}
              onPerRoleMappingsChange={(m) => setPerRoleMappings(m)}
              selectedPOS={selectedPOS}
              onCanProceed={setCanProceed}
            />
          );
        case 2:
          return (
            <InventoryReviewStep
              fileAssignments={fileAssignments}
              perRoleMappings={perRoleMappings as PerRoleMappings}
              dispensaryLicense={dispensaryLicense}
              onCanProceed={setCanProceed}
              onDerivedRowsChange={setInventoryDerivedRows}
              onWarningCountChange={setWarningCount}
              fixes={fixes}
              onFixesChange={setFixes}
              selectedStore={selectedStore}
            />
          );
        case 3:
          return (
            <InventoryImportStep
              derivedRows={inventoryDerivedRows}
              selectedStore={selectedStore}
              dispensaryLicense={dispensaryLicense}
              onStartNew={handleStartNew}
            />
          );
        default:
          return <StepPlaceholder stepName={STEP_LABELS[currentStep]} />;
      }
    }

    // Catalog branch (existing, unchanged)
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
      case 3:
        return (
          <ImportStep
            derivedRows={derivedRows}
            parsedFiles={parsedFiles}
            mappings={mappings}
            fixes={fixes}
            onStartNew={handleStartNew}
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

      {/* Store selector banner (inventory mode only) */}
      {wizardType === 'inventory' && (
        <StoreSelector
          selectedStore={selectedStore}
          onStoreChange={handleStoreChange}
          stores={stores}
          loading={storesLoading}
          error={storesError}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-auto bg-gray-50">
        {renderStep()}
      </div>

      {/* Footer navigation -- hidden on Import step (step 3 manages its own flow) */}
      {currentStep !== 3 && (
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
      )}
    </div>
  );
}
