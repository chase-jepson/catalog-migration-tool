import { act, createElement, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryImportStep } from "../components/inventory/InventoryImportStep";
import { getPortalAuth } from "../lib/portal-auth";
import { sendMessage } from "../lib/messaging";

vi.mock("../lib/messaging", () => ({
  sendMessage: vi.fn(),
}));

vi.mock("../lib/portal-auth", () => ({
  getPortalAuth: vi.fn(),
}));

const sendMessageMock = vi.mocked(sendMessage);
const getPortalAuthMock = vi.mocked(getPortalAuth);

function renderPortalImportStep(
  overrides: Partial<ComponentProps<typeof InventoryImportStep>> = {},
) {
  const onDone = vi.fn();

  render(
    createElement(InventoryImportStep, {
      derivedRows: [{ excluded: false, invoiceId: "", distributorName: "" }] as any,
      selectedStore: { entityId: "store-1", name: "Downtown" },
      dispensaryLicense: "LIC-123",
      portalJobId: "job-1",
      portalStoreId: "portal-store-1",
      onStartNew: vi.fn(),
      onDone,
      ...overrides,
    }),
  );

  return { onDone };
}

async function runPortalImport() {
  await act(async () => {
    fireEvent.click(screen.getByText("Import"));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
  });
}

describe("InventoryImportStep", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
    getPortalAuthMock.mockResolvedValue({ token: "portal-token" } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders failed portal jobs as failure instead of success", async () => {
    sendMessageMock.mockImplementation((async (type: Parameters<typeof sendMessage>[0]) => {
      if (type === "portalExecute") return {};
      if (type === "portalGetJob") {
        return {
          id: "job-1",
          status: "FAILED",
          total_rows: null,
          error_summary: "Portal validation failed",
          succeeded_rows: 2,
          failed_rows: 1,
          processed_invoices: 3,
          total_invoices: 3,
          started_at: null,
          completed_at: null,
        };
      }

      throw new Error(`Unexpected message: ${type}`);
    }) as any);

    const { onDone } = renderPortalImportStep();
    await runPortalImport();

    expect(screen.getByText("Inventory import failed")).toBeDefined();
    expect(screen.queryByText("Inventory import completed successfully")).toBeNull();
    expect(screen.getByText(/2 rows were imported before failure/i)).toBeDefined();
    expect(screen.getByText("Rollback Import")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("renders completed portal jobs as success and signals completion", async () => {
    sendMessageMock.mockImplementation((async (type: Parameters<typeof sendMessage>[0]) => {
      if (type === "portalExecute") return {};
      if (type === "portalGetJob") {
        return {
          id: "job-1",
          status: "COMPLETED",
          total_rows: null,
          error_summary: null,
          succeeded_rows: 4,
          failed_rows: 0,
          processed_invoices: 4,
          total_invoices: 4,
          started_at: null,
          completed_at: null,
        };
      }

      throw new Error(`Unexpected message: ${type}`);
    }) as any);

    const { onDone } = renderPortalImportStep();
    await runPortalImport();

    expect(screen.getByText("Inventory import completed successfully")).toBeDefined();
    expect(screen.getByText(/4 rows imported/i)).toBeDefined();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("renders rolled back portal jobs distinctly and signals completion", async () => {
    sendMessageMock.mockImplementation((async (type: Parameters<typeof sendMessage>[0]) => {
      if (type === "portalExecute") return {};
      if (type === "portalGetJob") {
        return {
          id: "job-1",
          status: "ROLLED_BACK",
          total_rows: null,
          error_summary: null,
          succeeded_rows: 0,
          failed_rows: 0,
          processed_invoices: 0,
          total_invoices: 1,
          started_at: null,
          completed_at: null,
        };
      }

      throw new Error(`Unexpected message: ${type}`);
    }) as any);

    const { onDone } = renderPortalImportStep();
    await runPortalImport();

    expect(screen.getByText("Import rolled back successfully")).toBeDefined();
    expect(screen.queryByText("Inventory import completed successfully")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
