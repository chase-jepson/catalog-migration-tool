import { useCallback, useEffect, useRef, useState } from "react";
import { STEP_LABELS } from "../../lib/constants";
import { StepIndicator } from "./StepIndicator";
import { StepPlaceholder } from "./StepPlaceholder";
import { UploadStep } from "../upload/UploadStep";
import { MappingStep } from "../mapping/MappingStep";
import { ReviewStep } from "../review/ReviewStep";
import { ImportStep } from "../import/ImportStep";
import { StoreSelector } from "../inventory/StoreSelector";
import { InventoryUploadStep } from "../inventory/InventoryUploadStep";
import { InventoryMappingStep } from "../inventory/InventoryMappingStep";
import { InventoryReviewStep } from "../inventory/InventoryReviewStep";
import { InventoryImportStep } from "../inventory/InventoryImportStep";
import { mergeFiles } from "../../lib/parser";
import { applyPOSDefaults } from "../../lib/mapping-engine";
import {
  saveMigrationState,
  loadMigrationState,
  clearMigrationState,
} from "../../lib/migration-store";
import {
  saveInventoryState,
  loadInventoryState,
  clearInventoryState,
} from "../../lib/inventory-migration-store";
import {
  createEmptyInventoryMappings,
  INVENTORY_POS_DEFAULTS,
  INVENTORY_MAPPING_FIELDS,
  INVENTORY_ROLE_POS_DEFAULTS,
  INVENTORY_ROLE_FIELDS,
} from "../../lib/inventory-constants";
import { extractStoreClaimsFromToken } from "../../lib/store-api";
import { sendMessage } from "../../lib/messaging";
import { detectEnvironment, getMsoApiBaseUrl } from "../../lib/env";
import type { PerRoleMappings } from "../../lib/inventory-transformer";
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
} from "../../lib/types";

interface WizardShellProps {
  wizardType: "catalog" | "inventory";
  onClose?: () => void;
}

const EMPTY_PER_ROLE_MAPPINGS: PerRoleMappingsState = {
  inventory: [],
  receipts: [],
  vendors: [],
  adjustments: [],
  catalog_export: [],
};

export function WizardShell({ wizardType, onClose }: WizardShellProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [mergedFile, setMergedFile] = useState<ParsedFile | null>(null);
  const [selectedPOS, setSelectedPOS] = useState("");
  const [detectedPOS, setDetectedPOS] = useState<POSDetectionResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [fixes, setFixes] = useState<RowFix[]>([]);
  const [derivedRows, setDerivedRows] = useState<DerivedRow[]>([]);
  const [canProceed, setCanProceed] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [restored, setRestored] = useState(false);

  // ── Inventory-specific state ────────────────────────────────────────────
  const [selectedStore, setSelectedStore] = useState<StoreInfo | null>(null);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [inventoryDerivedRows, setInventoryDerivedRows] = useState<InventoryDerivedRow[]>([]);
  const [portalJobId, setPortalJobId] = useState<string | null>(null);
  const [portalStoreId, setPortalStoreId] = useState<string | null>(null);
  const [fileAssignments, setFileAssignments] = useState<InventoryFileAssignment[]>([]);
  const [dispensaryLicense, setDispensaryLicense] = useState("TEMP-C00-00000000-LIC");
  const [perRoleMappings, setPerRoleMappings] = useState<PerRoleMappingsState>({
    ...EMPTY_PER_ROLE_MAPPINGS,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const title = wizardType === "catalog" ? "Migrate Catalog" : "Migrate Inventory";
  const lastStep = STEP_LABELS.length - 1;

  // ── Fetch stores on mount (inventory mode only) ─────────────────────────
  useEffect(() => {
    if (wizardType !== "inventory") return;

    let cancelled = false;
    setStoresLoading(true);
    setStoresError(null);

    (async () => {
      try {
        // Get current page URL — works in both side panel and content script contexts
        let tabUrl = "";
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabUrl = tab?.url ?? "";
        } catch {
          // Content scripts can't use chrome.tabs — use page location directly
          tabUrl = window.location.href;
        }
        const { token } = await sendMessage("getAuthToken", { appUrl: tabUrl });
        if (!token) {
          throw new Error("No auth token available. Please refresh the Treez page.");
        }

        // Extract org/entity claims from JWT
        const claims = extractStoreClaimsFromToken(token);
        if (!claims) {
          throw new Error(
            "Could not extract store claims from token. JWT may be missing required fields.",
          );
        }

        // Detect environment for MSO API URL
        const env = detectEnvironment(tabUrl);
        if (!env) {
          throw new Error("Could not detect Treez environment from current page.");
        }

        const apiBaseUrl = getMsoApiBaseUrl(env);
        const storeList = await sendMessage("fetchStores", {
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
          setStoresError(err instanceof Error ? err.message : "Failed to fetch stores");
          setStoresLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [wizardType]);

  // ── Clear persisted state on mount (always start fresh) ─────────────────
  useEffect(() => {
    if (wizardType === "inventory") {
      clearInventoryState();
    } else {
      clearMigrationState();
    }
    setRestored(true);
  }, [wizardType]);

  // ── Debounced persistence on state changes ──────────────────────────────
  useEffect(() => {
    if (!restored) return; // Don't save during restore

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (wizardType === "inventory") {
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
  }, [
    parsedFiles,
    mergedFile,
    selectedPOS,
    selectedStore,
    mappings,
    perRoleMappings,
    fixes,
    currentStep,
    restored,
    wizardType,
    fileAssignments,
    dispensaryLicense,
  ]);

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
        if (wizardType === "inventory") {
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
      if (wizardType === "inventory") {
        const allPerRoleEmpty = Object.values(perRoleMappings).every(
          (roleMappings: FieldMapping[]) =>
            roleMappings.length === 0 ||
            roleMappings.every((m: FieldMapping) => m.sourceHeader === null),
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
  const handleStoreChange = useCallback((store: StoreInfo | null) => {
    setSelectedStore(store);
    // Reset wizard state on store change
    setParsedFiles([]);
    setMergedFile(null);
    setSelectedPOS("");
    setDetectedPOS(null);
    setMappings([]);
    setFixes([]);
    setInventoryDerivedRows([]);
    setFileAssignments([]);
    setDispensaryLicense("TEMP-C00-00000000-LIC");
    setPerRoleMappings({ ...EMPTY_PER_ROLE_MAPPINGS });
    setCanProceed(false);
    setCurrentStep(0);
  }, []);

  // ── Start New Migration (clears all state, resets wizard) ──────────────
  const handleStartNew = useCallback(async () => {
    if (wizardType === "inventory") {
      await clearInventoryState();
    } else {
      await clearMigrationState();
    }
    setParsedFiles([]);
    setMergedFile(null);
    setSelectedPOS("");
    setDetectedPOS(null);
    setMappings([]);
    setFixes([]);
    setDerivedRows([]);
    setInventoryDerivedRows([]);
    setSelectedStore(null);
    setFileAssignments([]);
    setDispensaryLicense("TEMP-C00-00000000-LIC");
    setPerRoleMappings({ ...EMPTY_PER_ROLE_MAPPINGS });
    setCanProceed(false);
    setCurrentStep(0);
  }, [wizardType]);

  const nextButtonLabel = "Next";

  // ── Render step content ─────────────────────────────────────────────────
  const renderStep = () => {
    // Inventory branch
    if (wizardType === "inventory") {
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
              onPortalJobId={setPortalJobId}
              onPortalStoreId={setPortalStoreId}
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
              portalJobId={portalJobId}
              portalStoreId={portalStoreId}
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
            selectedPOS={selectedPOS}
            onStartNew={handleStartNew}
            onDone={() => setImportDone(true)}
          />
        );
      default:
        return <StepPlaceholder stepName={STEP_LABELS[currentStep]} />;
    }
  };

  return (
    <div className="flex h-full flex-col font-[Roboto,sans-serif]">
      {/* Header — matches Treez drawer header (24px 32px 16px padding) */}
      <div className="bg-white">
        <div className="flex items-center justify-between" style={{ padding: "24px 32px 16px" }}>
          <div className="min-w-0 flex-1">
            <h1
              className="font-[Roboto,sans-serif] font-normal"
              style={{ color: "#0f1709", fontSize: "18px" }}
            >
              {title}
            </h1>
          </div>
          {/* Close icon — matches Treez material-symbols close */}
          <button
            type="button"
            onClick={() => {
              chrome.storage.session.remove("wizardType");
              if (onClose) {
                onClose();
              } else {
                try {
                  window.close();
                } catch (_) {
                  /* side panel fallback */
                }
              }
            }}
            className="ml-2 flex shrink-0 items-center justify-center hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-none p-0"
            style={{ color: "#1a1a1a" }}
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ width: "20px", height: "20px" }}
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <StepIndicator steps={[...STEP_LABELS]} current={currentStep} />
      </div>

      {/* Store selector banner (inventory mode only) */}
      {wizardType === "inventory" && (
        <StoreSelector
          selectedStore={selectedStore}
          onStoreChange={handleStoreChange}
          stores={stores}
          loading={storesLoading}
          error={storesError}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-auto bg-gray-50">{renderStep()}</div>

      {/* Footer — matches Treez drawer elevated bottom bar */}
      <div
        className="flex items-center justify-between bg-white"
        style={{
          padding: "16px 24px",
          borderTop: "1px solid #e0e0e0",
          boxShadow:
            "rgba(0,0,0,0.2) 0px 3px 3px -2px, rgba(0,0,0,0.14) 0px 3px 4px 0px, rgba(0,0,0,0.12) 0px 1px 8px 0px",
        }}
      >
        <div className="flex items-center gap-3">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s - 1)}
              className="btn-treez -secondary"
            >
              Back
            </button>
          ) : null}
          <a
            href="https://gitlab.com/chase_jepson/catalog-migration-tool-v2/-/issues/new?issuable_template=Bug%20Report"
            target="_blank"
            rel="noopener noreferrer"
            className="font-[Roboto,sans-serif] text-xs tracking-wide text-gray-400 no-underline transition-colors hover:text-gray-500"
          >
            Report an issue
          </a>
        </div>
        {currentStep < lastStep ? (
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => setCurrentStep((s) => s + 1)}
            className="btn-treez -primary"
          >
            {nextButtonLabel}
          </button>
        ) : importDone ? (
          <button
            type="button"
            onClick={() => {
              chrome.storage.session.remove("wizardType");
              if (onClose) {
                onClose();
              } else {
                try {
                  window.close();
                } catch (_) {
                  /* side panel fallback */
                }
              }
            }}
            className="btn-treez -primary"
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
