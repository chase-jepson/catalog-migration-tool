import { describe, expect, it, vi } from "vitest";
import { runCatalogImportSequence } from "../lib/catalog-import-runner";
import type { ImportFileState, OutputCSVs } from "../lib/types";

const csvs: OutputCSVs = {
  brands: [["Name"], ["Brand A"]],
  attributes: [["Name"]],
  products: [["Name"], ["Product A"]],
  variants: [["Name"]],
  attributeJoins: [["Name"]],
  images: [["Name"]],
  skippedReport: [["Name"]],
};

function makeFileStates(): ImportFileState[] {
  return [
    {
      key: "brands",
      label: "Brands",
      status: "pending",
      rowCount: 1,
      processedCount: 0,
      errorCount: 0,
    },
    {
      key: "attributes",
      label: "Attributes",
      status: "pending",
      rowCount: 0,
      processedCount: 0,
      errorCount: 0,
    },
    {
      key: "products",
      label: "Products",
      status: "pending",
      rowCount: 1,
      processedCount: 0,
      errorCount: 0,
    },
    {
      key: "variants",
      label: "Variants",
      status: "pending",
      rowCount: 0,
      processedCount: 0,
      errorCount: 0,
    },
    {
      key: "attributeJoins",
      label: "Attribute Joins",
      status: "pending",
      rowCount: 0,
      processedCount: 0,
      errorCount: 0,
    },
    {
      key: "images",
      label: "Images",
      status: "pending",
      rowCount: 0,
      processedCount: 0,
      errorCount: 0,
    },
  ];
}

function makeImportFileName(label: string): string {
  const timestamp = new Date(2026, 3, 1, 12, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${label} - ${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}-${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}.csv`;
}

describe("runCatalogImportSequence", () => {
  it("imports files in sequence and reports the total imported rows", async () => {
    const now = new Date(2026, 3, 1, 12, 0, 0);
    const sendMessage = vi.fn(async (type: string, data?: any) => {
      if (type === "getPresignedUrl") return { presignedUrl: `https://upload/${data.params.name}` };
      if (type === "uploadToS3") return { ok: true };
      if (type === "fetchImportReport") {
        return [
          { id: "job-1", name: makeImportFileName("Brands"), status: "FINISHED", totalRows: 1, countProcessed: 1, countError: 0 },
          { id: "job-2", name: makeImportFileName("Products"), status: "FINISHED", totalRows: 1, countProcessed: 1, countError: 0 },
        ];
      }
      throw new Error(`Unexpected message: ${type}`);
    });

    const result = await runCatalogImportSequence({
      csvs,
      initialFileStates: makeFileStates(),
      getTokenAndUrl: async () => ({ apiBaseUrl: "https://api.example.com", token: "token" }),
      sendMessage: sendMessage as any,
      now: () => now,
      wait: async () => {},
      onCurrentFileIndexChange: () => {},
      onEtaChange: () => {},
      onFileStatesChange: () => {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.totalImported).toBe(2);
      expect(result.fileStates.find((file) => file.key === "brands")?.status).toBe("done");
      expect(result.fileStates.find((file) => file.key === "products")?.status).toBe("done");
    }
  });

  it("supports retry from a failed file without re-running earlier completed files", async () => {
    const now = new Date(2026, 3, 1, 12, 0, 0);
    const sendMessage = vi.fn(async (type: string, data?: any) => {
      if (type === "getPresignedUrl") return { presignedUrl: `https://upload/${data.params.name}` };
      if (type === "uploadToS3") return { ok: true };
      if (type === "fetchImportReport") {
        return [
          { id: "job-2", name: makeImportFileName("Products"), status: "FINISHED", totalRows: 1, countProcessed: 1, countError: 0 },
        ];
      }
      throw new Error(`Unexpected message: ${type}`);
    });

    const states = makeFileStates();
    states[0] = { ...states[0], status: "done", processedCount: 1 };
    states[2] = { ...states[2], status: "pending", processedCount: 0 };

    const result = await runCatalogImportSequence({
      csvs,
      initialFileStates: states,
      resumeFromIndex: 2,
      getTokenAndUrl: async () => ({ apiBaseUrl: "https://api.example.com", token: "token" }),
      sendMessage: sendMessage as any,
      now: () => now,
      wait: async () => {},
      onCurrentFileIndexChange: () => {},
      onEtaChange: () => {},
      onFileStatesChange: () => {},
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileStates[0].status).toBe("done");
      expect(result.fileStates[2].status).toBe("done");
      expect(result.totalImported).toBe(2);
    }

    expect(sendMessage.mock.calls.filter(([type]) => type === "getPresignedUrl")).toHaveLength(1);
  });
});
