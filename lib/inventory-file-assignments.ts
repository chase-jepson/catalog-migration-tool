import type { InventoryFileAssignment } from "./types";
import type { ETLInput } from "./inventory-transformer";

export function getDuplicateInventoryRoles(
  assignments: InventoryFileAssignment[],
): Partial<Record<InventoryFileAssignment["role"], string[]>> {
  const byRole = new Map<InventoryFileAssignment["role"], string[]>();

  for (const assignment of assignments) {
    const fileNames = byRole.get(assignment.role) ?? [];
    fileNames.push(assignment.file.fileName);
    byRole.set(assignment.role, fileNames);
  }

  return Object.fromEntries(
    Array.from(byRole.entries()).filter(([, fileNames]) => fileNames.length > 1),
  ) as Partial<Record<InventoryFileAssignment["role"], string[]>>;
}

export function hasDuplicateInventoryRoles(assignments: InventoryFileAssignment[]): boolean {
  return Object.keys(getDuplicateInventoryRoles(assignments)).length > 0;
}

type BuildInventoryETLInputResult =
  | { ok: true; input: ETLInput }
  | { ok: false; reason: string };

export function buildInventoryETLInput(
  assignments: InventoryFileAssignment[],
): BuildInventoryETLInputResult {
  const duplicates = getDuplicateInventoryRoles(assignments);
  const duplicateRoles = Object.keys(duplicates);

  if (duplicateRoles.length > 0) {
    return {
      ok: false,
      reason: `Each inventory file role must be assigned only once. Duplicate roles: ${duplicateRoles.join(", ")}`,
    };
  }

  const inventoryAssign = assignments.find((a) => a.role === "inventory");
  if (!inventoryAssign) {
    return {
      ok: false,
      reason: "An inventory file is required before ETL can run.",
    };
  }

  return {
    ok: true,
    input: {
      inventoryFile: inventoryAssign.file,
      receiptsFile: assignments.find((a) => a.role === "receipts")?.file,
      vendorsFile: assignments.find((a) => a.role === "vendors")?.file,
      adjustmentsFile: assignments.find((a) => a.role === "adjustments")?.file,
      catalogFile: assignments.find((a) => a.role === "catalog_export")?.file,
    },
  };
}
