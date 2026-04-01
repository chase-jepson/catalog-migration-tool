import type { PersistedInventoryState, PersistedMigrationState } from "./types";
import { ensureParsedFileIds } from "./parser";

export function normalizeMigrationResumeState(
  state: PersistedMigrationState,
): PersistedMigrationState {
  const parsedFiles = ensureParsedFileIds(state.parsedFiles);
  let currentStep = state.currentStep;

  if (!parsedFiles.length) {
    currentStep = 0;
  } else if (currentStep >= 2 && state.mappings.length === 0) {
    currentStep = 1;
  }

  if (currentStep >= 3 && (state.derivedRows?.length ?? 0) === 0) {
    currentStep = 2;
  }

  return {
    ...state,
    parsedFiles,
    currentStep,
    detectedPOS: state.detectedPOS ?? null,
    derivedRows: state.derivedRows ?? [],
  };
}

export function normalizeInventoryResumeState(
  state: PersistedInventoryState,
): PersistedInventoryState {
  const parsedFiles = ensureParsedFileIds(state.parsedFiles);
  const fileIdMap = new Map(parsedFiles.map((file) => [file.fileName, file]));
  const fileAssignments = state.fileAssignments.map((assignment) => ({
    ...assignment,
    file: assignment.file.id
      ? assignment.file
      : (fileIdMap.get(assignment.file.fileName) ?? assignment.file),
  }));
  let currentStep = state.currentStep;

  if (!parsedFiles.length || fileAssignments.length === 0) {
    currentStep = 0;
  } else if (currentStep >= 2 && !state.selectedStore) {
    currentStep = 0;
  }

  if (currentStep >= 3 && (state.inventoryDerivedRows?.length ?? 0) === 0) {
    currentStep = 2;
  }

  const shouldKeepPortalContext =
    currentStep >= 3 && (state.inventoryDerivedRows?.length ?? 0) > 0;

  return {
    ...state,
    parsedFiles,
    fileAssignments,
    currentStep,
    detectedPOS: state.detectedPOS ?? null,
    inventoryDerivedRows: state.inventoryDerivedRows ?? [],
    portalJobId: shouldKeepPortalContext ? (state.portalJobId ?? null) : null,
    portalStoreId: shouldKeepPortalContext ? (state.portalStoreId ?? null) : null,
  };
}
