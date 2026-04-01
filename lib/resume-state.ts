import type { PersistedInventoryState, PersistedMigrationState } from "./types";

export function normalizeMigrationResumeState(
  state: PersistedMigrationState,
): PersistedMigrationState {
  let currentStep = state.currentStep;

  if (!state.parsedFiles.length) {
    currentStep = 0;
  } else if (currentStep >= 2 && state.mappings.length === 0) {
    currentStep = 1;
  }

  if (currentStep >= 3 && (state.derivedRows?.length ?? 0) === 0) {
    currentStep = 2;
  }

  return {
    ...state,
    currentStep,
    detectedPOS: state.detectedPOS ?? null,
    derivedRows: state.derivedRows ?? [],
  };
}

export function normalizeInventoryResumeState(
  state: PersistedInventoryState,
): PersistedInventoryState {
  let currentStep = state.currentStep;

  if (!state.parsedFiles.length || state.fileAssignments.length === 0) {
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
    currentStep,
    detectedPOS: state.detectedPOS ?? null,
    inventoryDerivedRows: state.inventoryDerivedRows ?? [],
    portalJobId: shouldKeepPortalContext ? (state.portalJobId ?? null) : null,
    portalStoreId: shouldKeepPortalContext ? (state.portalStoreId ?? null) : null,
  };
}
