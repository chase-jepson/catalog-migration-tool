import { describe, it, expect } from "vitest";
import {
  groupBy,
  sumByGroup,
  leftJoin,
  fullJoin,
  formatDateToISO,
  splitPotency,
  extractInvoiceId,
  deriveCustomerType,
  deriveLocationPath,
  deriveLocationIsSellable,
  deriveLocationDefaultReceiving,
  deriveLocationInventoryType,
} from "../lib/inventory-etl-helpers";

// ── groupBy ─────────────────────────────────────────────────────────────────

describe("groupBy", () => {
  it("groups array of objects by a key function", () => {
    const data = [
      { name: "Alice", dept: "eng" },
      { name: "Bob", dept: "sales" },
      { name: "Carol", dept: "eng" },
    ];
    const result = groupBy(data, (r) => r.dept);
    expect(result.get("eng")).toHaveLength(2);
    expect(result.get("sales")).toHaveLength(1);
  });

  it("returns empty map for empty array", () => {
    const result = groupBy([], (r: any) => r.key);
    expect(result.size).toBe(0);
  });

  it("handles single-element groups", () => {
    const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = groupBy(data, (r) => String(r.id));
    expect(result.size).toBe(3);
    expect(result.get("1")).toEqual([{ id: 1 }]);
  });
});

// ── sumByGroup ──────────────────────────────────────────────────────────────

describe("sumByGroup", () => {
  it("groups and sums specified numeric fields", () => {
    const data = [
      { pkg: "A", Quantity: "10", TotalCost: "100" },
      { pkg: "A", Quantity: "5", TotalCost: "50" },
      { pkg: "B", Quantity: "3", TotalCost: "30" },
    ];
    const result = sumByGroup(data, (r) => r.pkg, ["Quantity", "TotalCost"]);
    expect(result).toHaveLength(2);
    const groupA = result.find((r) => r._groupKey === "A");
    expect(groupA?.Quantity).toBe(15);
    expect(groupA?.TotalCost).toBe(150);
    const groupB = result.find((r) => r._groupKey === "B");
    expect(groupB?.Quantity).toBe(3);
    expect(groupB?.TotalCost).toBe(30);
  });

  it("returns empty for empty input", () => {
    const result = sumByGroup([], (r: any) => r.key, ["Quantity"]);
    expect(result).toHaveLength(0);
  });

  it("handles non-numeric values as 0", () => {
    const data = [
      { pkg: "A", Quantity: "abc", TotalCost: "50" },
      { pkg: "A", Quantity: "10", TotalCost: "" },
    ];
    const result = sumByGroup(data, (r) => r.pkg, ["Quantity", "TotalCost"]);
    expect(result[0].Quantity).toBe(10);
    expect(result[0].TotalCost).toBe(50);
  });
});

// ── leftJoin ────────────────────────────────────────────────────────────────

describe("leftJoin", () => {
  it("joins two arrays on matching keys", () => {
    const left = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const right = [{ id: "1", dept: "eng" }];

    const result = leftJoin(
      left,
      right,
      (r) => r.id,
      (r) => r.id,
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: "1", name: "Alice", dept: "eng" });
    // Unmatched left row gets empty right fields
    expect(result[1].name).toBe("Bob");
    expect(result[1].dept).toBe("");
  });

  it("handles empty right array", () => {
    const left = [{ id: "1", name: "Alice" }];
    const result = leftJoin(
      left,
      [],
      (r) => r.id,
      (r: any) => r.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alice");
  });

  it("handles duplicate keys in right (first match wins)", () => {
    const left = [{ id: "1", name: "Alice" }];
    const right = [
      { id: "1", dept: "eng" },
      { id: "1", dept: "sales" },
    ];
    const result = leftJoin(
      left,
      right,
      (r) => r.id,
      (r) => r.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].dept).toBe("eng");
  });
});

// ── fullJoin ────────────────────────────────────────────────────────────────

describe("fullJoin", () => {
  it("includes rows from both sides", () => {
    const left = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const right = [
      { id: "2", dept: "eng" },
      { id: "3", dept: "sales" },
    ];
    const result = fullJoin(
      left,
      right,
      (r) => r.id,
      (r) => r.id,
    );
    expect(result).toHaveLength(3);

    const r1 = result.find((r) => r.id === "1");
    expect(r1?.name).toBe("Alice");
    expect(r1?.dept).toBe("");

    const r2 = result.find((r) => r.id === "2");
    expect(r2?.name).toBe("Bob");
    expect(r2?.dept).toBe("eng");

    const r3 = result.find((r) => r.id === "3");
    expect(r3?.name).toBe("");
    expect(r3?.dept).toBe("sales");
  });

  it("handles empty left", () => {
    const right = [{ id: "1", dept: "eng" }];
    const result = fullJoin(
      [],
      right,
      (r: any) => r.id,
      (r) => r.id,
    );
    expect(result).toHaveLength(1);
    expect(result[0].dept).toBe("eng");
  });

  it("handles empty both", () => {
    const result = fullJoin(
      [],
      [],
      (r: any) => r.id,
      (r: any) => r.id,
    );
    expect(result).toHaveLength(0);
  });
});

// ── formatDateToISO ─────────────────────────────────────────────────────────

describe("formatDateToISO", () => {
  it("converts MM/dd/yyyy to yyyy-MM-dd", () => {
    expect(formatDateToISO("02/11/2026")).toBe("2026-02-11");
  });

  it("converts M/d/yyyy to yyyy-MM-dd", () => {
    expect(formatDateToISO("2/4/2020")).toBe("2020-02-04");
  });

  it("returns empty for empty input", () => {
    expect(formatDateToISO("")).toBe("");
  });

  it("returns empty for null/undefined input", () => {
    expect(formatDateToISO(null as any)).toBe("");
    expect(formatDateToISO(undefined as any)).toBe("");
  });

  it("handles single-digit month and day", () => {
    expect(formatDateToISO("1/5/2023")).toBe("2023-01-05");
  });
});

// ── splitPotency ────────────────────────────────────────────────────────────

describe("splitPotency", () => {
  it('splits "23.5 %" into amount and uom', () => {
    expect(splitPotency("23.5 %")).toEqual({ amount: "23.5", uom: "%" });
  });

  it('splits "150 mg" into amount and uom', () => {
    expect(splitPotency("150 mg")).toEqual({ amount: "150", uom: "mg" });
  });

  it('cleans "0.00 mg" to empty', () => {
    expect(splitPotency("0.00 mg")).toEqual({ amount: "", uom: "" });
  });

  it('cleans "0.00 %" to empty', () => {
    expect(splitPotency("0.00 %")).toEqual({ amount: "", uom: "" });
  });

  it('removes "mg/g" substring', () => {
    expect(splitPotency("23.5 mg/g %")).toEqual({ amount: "23.5", uom: "%" });
  });

  it("returns empty for empty input", () => {
    expect(splitPotency("")).toEqual({ amount: "", uom: "" });
  });

  it("returns empty for null/undefined", () => {
    expect(splitPotency(null as any)).toEqual({ amount: "", uom: "" });
    expect(splitPotency(undefined as any)).toEqual({ amount: "", uom: "" });
  });
});

// ── extractInvoiceId ────────────────────────────────────────────────────────

describe("extractInvoiceId", () => {
  it('extracts text after last " - " from order title', () => {
    expect(extractInvoiceId("PO-123 - INV456")).toBe("INV456");
  });

  it('returns full string when no " - " is present', () => {
    expect(extractInvoiceId("SimpleTitle")).toBe("SimpleTitle");
  });

  it('uses the last " - " when multiple present', () => {
    expect(extractInvoiceId("PO-123 - Sub - INV789")).toBe("INV789");
  });

  it("returns empty for empty input", () => {
    expect(extractInvoiceId("")).toBe("");
  });
});

// ── deriveCustomerType ──────────────────────────────────────────────────────

describe("deriveCustomerType", () => {
  it('"All enabled customer types" -> ADULT', () => {
    expect(deriveCustomerType("All enabled customer types")).toBe("ADULT");
  });

  it('"Adult" -> ADULT', () => {
    expect(deriveCustomerType("Adult")).toBe("ADULT");
  });

  it("empty string -> ADULT", () => {
    expect(deriveCustomerType("")).toBe("ADULT");
  });

  it('"Medical" -> MEDICAL', () => {
    expect(deriveCustomerType("Medical")).toBe("MEDICAL");
  });

  it("other values -> MEDICAL", () => {
    expect(deriveCustomerType("Medical Only")).toBe("MEDICAL");
  });
});

// ── deriveLocationPath ──────────────────────────────────────────────────────

describe("deriveLocationPath", () => {
  it("Sales Floor -> Front of House, Sales Floor", () => {
    expect(deriveLocationPath("Sales Floor")).toBe("Front of House, Sales Floor");
  });

  it("Back Stock -> Back of House, Back Stock", () => {
    expect(deriveLocationPath("Back Stock")).toBe("Back of House, Back Stock");
  });

  it("Budtender Vault -> Back of House, Budtender Vault", () => {
    expect(deriveLocationPath("Budtender Vault")).toBe("Back of House, Budtender Vault");
  });

  it("Promo -> Back of House, Promo", () => {
    expect(deriveLocationPath("Promo")).toBe("Back of House, Promo");
  });

  it("Display -> Back of House, Display", () => {
    expect(deriveLocationPath("Display")).toBe("Back of House, Display");
  });

  it("Waste -> Quarantine", () => {
    expect(deriveLocationPath("Waste")).toBe("Quarantine");
  });

  it("unknown room -> empty string", () => {
    expect(deriveLocationPath("Unknown")).toBe("");
  });

  it("empty string -> empty string", () => {
    expect(deriveLocationPath("")).toBe("");
  });
});

// ── deriveLocationIsSellable ────────────────────────────────────────────────

describe("deriveLocationIsSellable", () => {
  it("Front of House path -> TRUE", () => {
    expect(deriveLocationIsSellable("Front of House, Sales Floor")).toBe("TRUE");
  });

  it("Back of House path -> FALSE", () => {
    expect(deriveLocationIsSellable("Back of House, Back Stock")).toBe("FALSE");
  });

  it("empty path -> FALSE", () => {
    expect(deriveLocationIsSellable("")).toBe("FALSE");
  });
});

// ── deriveLocationDefaultReceiving ──────────────────────────────────────────

describe("deriveLocationDefaultReceiving", () => {
  it('"Back of House, Back Stock" -> TRUE', () => {
    expect(deriveLocationDefaultReceiving("Back of House, Back Stock")).toBe("TRUE");
  });

  it("other paths -> FALSE", () => {
    expect(deriveLocationDefaultReceiving("Front of House, Sales Floor")).toBe("FALSE");
    expect(deriveLocationDefaultReceiving("Back of House, Budtender Vault")).toBe("FALSE");
    expect(deriveLocationDefaultReceiving("")).toBe("FALSE");
  });
});

// ── deriveLocationInventoryType ─────────────────────────────────────────────

describe("deriveLocationInventoryType", () => {
  it('"MEDICAL" -> Medical', () => {
    expect(deriveLocationInventoryType("MEDICAL")).toBe("Medical");
  });

  it('"ADULT" -> All Types', () => {
    expect(deriveLocationInventoryType("ADULT")).toBe("All Types");
  });

  it("empty -> All Types", () => {
    expect(deriveLocationInventoryType("")).toBe("All Types");
  });
});
