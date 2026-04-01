import { describe, expect, it } from "vitest";
import {
  buildInventoryETLInput,
  getDuplicateInventoryRoles,
  hasDuplicateInventoryRoles,
} from "../lib/inventory-file-assignments";
import type { InventoryFileAssignment, ParsedFile } from "../lib/types";

function makeParsedFile(id: string, fileName: string): ParsedFile {
  return {
    id,
    fileName,
    fileSize: 100,
    headers: ["SKU"],
    rows: [{ SKU: "sku-1" }],
    rowCount: 1,
    previewRows: [{ SKU: "sku-1" }],
  };
}

describe("inventory file assignment helpers", () => {
  it("detects duplicate roles", () => {
    const assignments: InventoryFileAssignment[] = [
      { file: makeParsedFile("file-1", "inventory-a.csv"), role: "inventory" },
      { file: makeParsedFile("file-2", "inventory-b.csv"), role: "inventory" },
      { file: makeParsedFile("file-3", "vendors.csv"), role: "vendors" },
    ];

    expect(hasDuplicateInventoryRoles(assignments)).toBe(true);
    expect(getDuplicateInventoryRoles(assignments)).toEqual({
      inventory: ["inventory-a.csv", "inventory-b.csv"],
    });
  });

  it("rejects ETL input when a role is assigned more than once", () => {
    const assignments: InventoryFileAssignment[] = [
      { file: makeParsedFile("file-1", "inventory-a.csv"), role: "inventory" },
      { file: makeParsedFile("file-2", "inventory-b.csv"), role: "inventory" },
    ];

    const result = buildInventoryETLInput(assignments);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("inventory");
    }
  });

  it("builds ETL input when every role is uniquely assigned", () => {
    const inventoryFile = makeParsedFile("file-1", "inventory.csv");
    const receiptsFile = makeParsedFile("file-2", "receipts.csv");
    const vendorsFile = makeParsedFile("file-3", "vendors.csv");

    const assignments: InventoryFileAssignment[] = [
      { file: inventoryFile, role: "inventory" },
      { file: receiptsFile, role: "receipts" },
      { file: vendorsFile, role: "vendors" },
    ];

    const result = buildInventoryETLInput(assignments);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.inventoryFile).toBe(inventoryFile);
      expect(result.input.receiptsFile).toBe(receiptsFile);
      expect(result.input.vendorsFile).toBe(vendorsFile);
    }
  });
});
