import type {
  ParsedFile,
  FieldMapping,
  InventoryDerivedRow,
} from './types';
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
} from './inventory-etl-helpers';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ETLInput {
  inventoryFile: ParsedFile;
  receiptsFile?: ParsedFile;
  vendorsFile?: ParsedFile;
  adjustmentsFile?: ParsedFile;
  catalogFile?: ParsedFile;
}

export interface PerRoleMappings {
  inventory: FieldMapping[];
  receipts: FieldMapping[];
  vendors: FieldMapping[];
  adjustments: FieldMapping[];
  catalog_export: FieldMapping[];
}

export interface DistributorInfo {
  distributorName: string;
  distributorDBA: string;
  distributorAddress: string;
  distributorPhoneNumber: string;
  distributorEmail: string;
  distributorType: string;
  distributorDefaultPaymentTerm: string;
  distributorLeadTime: string;
  distributorDeliveryDays: string;
  distributorPreferredPaymentMethod: string;
  distributorLicense1Type: string;
  distributorLicense1Number: string;
  distributorLicense1ExpirationDate: string;
  distributorLicense2Type: string;
  distributorLicense2Number: string;
  distributorLicense2ExpirationDate: string;
  distributorLicense3Type: string;
  distributorLicense3Number: string;
  distributorLicense3ExpirationDate: string;
  distributorRep1Name: string;
  distributorRep1Phone: string;
  distributorRep1Email: string;
  distributorRep1Role: string;
  distributorRep1Notes: string;
  distributorRep2Name: string;
  distributorRep2Phone: string;
  distributorRep2Email: string;
  distributorRep2Role: string;
  distributorRep2Notes: string;
  distributorRep3Name: string;
  distributorRep3Phone: string;
  distributorRep3Email: string;
  distributorRep3Role: string;
  distributorRep3Notes: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildFieldMap(mappings: FieldMapping[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const m of mappings) {
    map[m.fieldKey] = m.sourceHeader;
  }
  return map;
}

function getVal(
  row: Record<string, string>,
  fieldMap: Record<string, string | null>,
  fieldKey: string,
): string {
  const col = fieldMap[fieldKey];
  if (!col) return '';
  return (row[col] ?? '').trim();
}

function emptyDistributor(): DistributorInfo {
  return {
    distributorName: '',
    distributorDBA: '',
    distributorAddress: '',
    distributorPhoneNumber: '',
    distributorEmail: '',
    distributorType: '',
    distributorDefaultPaymentTerm: '',
    distributorLeadTime: '',
    distributorDeliveryDays: '',
    distributorPreferredPaymentMethod: '',
    distributorLicense1Type: '',
    distributorLicense1Number: '',
    distributorLicense1ExpirationDate: '',
    distributorLicense2Type: '',
    distributorLicense2Number: '',
    distributorLicense2ExpirationDate: '',
    distributorLicense3Type: '',
    distributorLicense3Number: '',
    distributorLicense3ExpirationDate: '',
    distributorRep1Name: '',
    distributorRep1Phone: '',
    distributorRep1Email: '',
    distributorRep1Role: '',
    distributorRep1Notes: '',
    distributorRep2Name: '',
    distributorRep2Phone: '',
    distributorRep2Email: '',
    distributorRep2Role: '',
    distributorRep2Notes: '',
    distributorRep3Name: '',
    distributorRep3Phone: '',
    distributorRep3Email: '',
    distributorRep3Role: '',
    distributorRep3Notes: '',
  };
}

// ── Phase A: Receipt Processing ─────────────────────────────────────────────

export interface InvoiceRow {
  ExternalPackageId: string;
  ProductSKU: string;
  ReceiveDate: string;
  Quantity: string;
  TotalCost: string;
  UnitCost: string;
  VendorName: string;
  OrderTitle: string;
  InvoiceId: string;
  InvoiceIdDate: string;
}

export function processReceipts(
  receiptRows: Record<string, string>[],
  adjustmentRows: Record<string, string>[],
  inventoryExternalPackageIds: Set<string>,
  receiptMappings: FieldMapping[],
  adjustmentMappings: FieldMapping[],
): InvoiceRow[] {
  if (receiptRows.length === 0) return [];

  const rcptMap = buildFieldMap(receiptMappings);
  const adjMap = buildFieldMap(adjustmentMappings);

  // A1: Extract receipt subset columns
  const receiptSubset = receiptRows.map((row) => ({
    ProductSKU: getVal(row, rcptMap, 'rcpt_productSKU'),
    ExternalPackageId: getVal(row, rcptMap, 'rcpt_externalPackageId'),
    ReceiveDate: getVal(row, rcptMap, 'rcpt_receiveDate'),
    Quantity: getVal(row, rcptMap, 'rcpt_quantity'),
    TotalCost: getVal(row, rcptMap, 'rcpt_totalCost'),
    VendorName: getVal(row, rcptMap, 'rcpt_vendorName'),
    OrderTitle: getVal(row, rcptMap, 'rcpt_orderTitle'),
  }));

  // A1 Step 3: Sum receipts by group
  const receiptSummed = sumByGroup(
    receiptSubset,
    (r) => `${r.ProductSKU}|${r.ReceiveDate}|${r.ExternalPackageId}|${r.VendorName}|${r.OrderTitle}`,
    ['Quantity', 'TotalCost'],
  );

  // A1 Step 5: Sum adjustments by ExternalPackageId
  const adjSubset = adjustmentRows.map((row) => ({
    ExternalPackageId: getVal(row, adjMap, 'adj_externalPackageId'),
    Quantity: getVal(row, adjMap, 'adj_quantity'),
    TotalCost: getVal(row, adjMap, 'adj_cost'),
  }));
  const adjSummed = sumByGroup(
    adjSubset,
    (r) => r.ExternalPackageId,
    ['Quantity', 'TotalCost'],
  );

  // A1 Step 6: Stack tables -- convert both to common format for re-sum
  const stackedForSum: { ExternalPackageId: string; Quantity: string; TotalCost: string }[] = [];

  for (const r of receiptSummed) {
    // Extract ExternalPackageId from the group key (3rd element)
    const keyParts = r._groupKey.split('|');
    stackedForSum.push({
      ExternalPackageId: keyParts[2],
      Quantity: String(r.Quantity),
      TotalCost: String(r.TotalCost),
    });
  }
  for (const a of adjSummed) {
    stackedForSum.push({
      ExternalPackageId: a._groupKey,
      Quantity: String(a.Quantity),
      TotalCost: String(a.TotalCost),
    });
  }

  // A1 Step 7: Re-sum by ExternalPackageId
  const combinedTotals = sumByGroup(
    stackedForSum,
    (r) => r.ExternalPackageId,
    ['Quantity', 'TotalCost'],
  );
  const totalsMap = new Map<string, { Quantity: number; TotalCost: number }>();
  for (const t of combinedTotals) {
    totalsMap.set(t._groupKey, {
      Quantity: Number(t.Quantity),
      TotalCost: Number(t.TotalCost),
    });
  }

  // A2: Descriptive invoice rows (one per receipt row, keep descriptive fields)
  // Build descriptive invoice info from original receipt subset
  const invoiceInfo = receiptSubset.map((r) => ({
    ExternalPackageId: r.ExternalPackageId,
    ReceiveDate: r.ReceiveDate,
    VendorName: r.VendorName,
    OrderTitle: r.OrderTitle,
    ProductSKU: r.ProductSKU,
  }));

  // A3: Merge -- left join invoice info + combined totals
  const merged = invoiceInfo.map((info) => {
    const totals = totalsMap.get(info.ExternalPackageId);
    const quantity = totals?.Quantity ?? 0;
    const totalCost = totals?.TotalCost ?? 0;
    const unitCost = quantity !== 0 ? Math.round((totalCost / quantity) * 100) / 100 : 0;

    const invoiceId = extractInvoiceId(info.OrderTitle);
    const invoiceIdDate = `${invoiceId} - ${info.ReceiveDate} - ${info.VendorName}`;

    return {
      ExternalPackageId: info.ExternalPackageId,
      ProductSKU: info.ProductSKU,
      ReceiveDate: info.ReceiveDate,
      Quantity: String(quantity),
      TotalCost: String(totalCost),
      UnitCost: String(unitCost),
      VendorName: info.VendorName,
      OrderTitle: info.OrderTitle,
      InvoiceId: invoiceIdDate,
      InvoiceIdDate: invoiceIdDate,
    };
  });

  // A3.5: Active Invoice ID filter
  // Phase 1: Find overlap
  const overlappingPkgIds = new Set<string>();
  for (const row of merged) {
    if (inventoryExternalPackageIds.has(row.ExternalPackageId)) {
      overlappingPkgIds.add(row.ExternalPackageId);
    }
  }

  // Get unique InvoiceIds from overlapping packages
  const activeInvoiceIds = new Set<string>();
  for (const row of merged) {
    if (overlappingPkgIds.has(row.ExternalPackageId)) {
      activeInvoiceIds.add(row.InvoiceId);
    }
  }

  // Phase 2: Pull ALL rows for active invoice IDs
  let activeRows = merged.filter((r) => activeInvoiceIds.has(r.InvoiceId));

  // Phase 3: Filter out rows where Quantity = 0
  activeRows = activeRows.filter((r) => Number(r.Quantity) !== 0);

  return activeRows;
}

// ── Phase B: Vendor/Distributor Processing ──────────────────────────────────

export function processVendors(
  vendorRows: Record<string, string>[],
  vendorMappings: FieldMapping[],
): Record<string, DistributorInfo> {
  const fm = buildFieldMap(vendorMappings);
  const result: Record<string, DistributorInfo> = {};

  // Generate expiration date: today + 2 years
  const now = new Date();
  const expDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;

  for (const row of vendorRows) {
    const name = getVal(row, fm, 'vnd_vendorName');
    if (!name) continue;

    // Build address
    const addressParts = [
      getVal(row, fm, 'vnd_address'),
      getVal(row, fm, 'vnd_city'),
      `${getVal(row, fm, 'vnd_state')} ${getVal(row, fm, 'vnd_postalCode')}`.trim(),
    ].filter(Boolean);
    const address = addressParts.join(', ');

    // License numbers
    const lic1 = getVal(row, fm, 'vnd_vendorCode');
    const lic2 = getVal(row, fm, 'vnd_vendorCode1');
    const lic3 = getVal(row, fm, 'vnd_vendorCode2');

    result[name] = {
      distributorName: name,
      distributorDBA: getVal(row, fm, 'vnd_abbreviation'),
      distributorAddress: address,
      distributorPhoneNumber: getVal(row, fm, 'vnd_contactPhone'),
      distributorEmail: getVal(row, fm, 'vnd_contactEmail'),
      distributorType: 'Non-Arms Length',
      distributorDefaultPaymentTerm: '',
      distributorLeadTime: '',
      distributorDeliveryDays: '',
      distributorPreferredPaymentMethod: '',
      distributorLicense1Type: lic1 ? 'Adult' : '',
      distributorLicense1Number: lic1,
      distributorLicense1ExpirationDate: lic1 ? expStr : '',
      distributorLicense2Type: lic2 ? 'Adult' : '',
      distributorLicense2Number: lic2,
      distributorLicense2ExpirationDate: lic2 ? expStr : '',
      distributorLicense3Type: lic3 ? 'Adult' : '',
      distributorLicense3Number: lic3,
      distributorLicense3ExpirationDate: lic3 ? expStr : '',
      distributorRep1Name: '',
      distributorRep1Phone: '',
      distributorRep1Email: '',
      distributorRep1Role: '',
      distributorRep1Notes: '',
      distributorRep2Name: '',
      distributorRep2Phone: '',
      distributorRep2Email: '',
      distributorRep2Role: '',
      distributorRep2Notes: '',
      distributorRep3Name: '',
      distributorRep3Phone: '',
      distributorRep3Email: '',
      distributorRep3Role: '',
      distributorRep3Notes: '',
    };
  }

  return result;
}

// ── Phase C: Inventory Processing ───────────────────────────────────────────

export interface InventoryProcessedRow {
  ProductSKU: string;
  ProductName: string;
  ExternalPackageId: string;
  Units: string;
  Cost: string;
  Category: string;
  HarvestDate: string;
  ExpirationDate: string;
  PackagedDate: string;
  thcAmount: string;
  thcUom: string;
  cbdAmount: string;
  cbdUom: string;
  customerType: string;
  locationPath: string;
  locationIsSellable: string;
  locationDefaultReceivingLocation: string;
  locationInventoryType: string;
}

export function processInventory(
  inventoryRows: Record<string, string>[],
  inventoryMappings: FieldMapping[],
): InventoryProcessedRow[] {
  const fm = buildFieldMap(inventoryMappings);

  return inventoryRows.map((row) => {
    const thcRaw = getVal(row, fm, 'inv_thc');
    const cbdRaw = getVal(row, fm, 'inv_cbd');
    const thc = splitPotency(thcRaw);
    const cbd = splitPotency(cbdRaw);
    const availableFor = getVal(row, fm, 'inv_availableFor');
    const room = getVal(row, fm, 'inv_room');
    const custType = deriveCustomerType(availableFor);
    const locPath = deriveLocationPath(room);

    return {
      ProductSKU: getVal(row, fm, 'inv_sku'),
      ProductName: getVal(row, fm, 'inv_product'),
      ExternalPackageId: getVal(row, fm, 'inv_externalPackageId'),
      Units: getVal(row, fm, 'inv_quantityIncAllocated'),
      Cost: getVal(row, fm, 'inv_cost'),
      Category: getVal(row, fm, 'inv_category'),
      HarvestDate: getVal(row, fm, 'inv_harvestDate'),
      ExpirationDate: getVal(row, fm, 'inv_expirationDate'),
      PackagedDate: getVal(row, fm, 'inv_packagingDate'),
      thcAmount: thc.amount,
      thcUom: thc.uom,
      cbdAmount: cbd.amount,
      cbdUom: cbd.uom,
      customerType: custType,
      locationPath: locPath,
      locationIsSellable: deriveLocationIsSellable(locPath),
      locationDefaultReceivingLocation: deriveLocationDefaultReceiving(locPath),
      locationInventoryType: deriveLocationInventoryType(custType),
    };
  });
}

// ── Phase D: Join Chain ─────────────────────────────────────────────────────

export function joinChain(
  inventoryData: Record<string, any>[],
  invoiceData: Record<string, any>[],
  distributorData: Record<string, DistributorInfo>,
  catalogData: Record<string, any>[],
): Record<string, any>[] {
  // Step 1: Full join inventory + invoice on ExternalPackageId
  let result: Record<string, any>[];
  if (invoiceData.length > 0) {
    result = fullJoin(
      inventoryData,
      invoiceData,
      (r) => r.ExternalPackageId,
      (r) => r.ExternalPackageId,
    );
  } else {
    result = inventoryData.map((r) => ({ ...r }));
  }

  // Step 2: Left join result + distributor on VendorName
  if (Object.keys(distributorData).length > 0) {
    result = result.map((row) => {
      const vendorName = row.VendorName ?? '';
      const distInfo = distributorData[vendorName];
      if (distInfo) {
        return { ...row, ...distInfo };
      }
      return { ...row, ...emptyDistributor() };
    });
  } else {
    result = result.map((row) => ({ ...row, ...emptyDistributor() }));
  }

  // Step 3: Left join result + catalog on ProductSKU = ProductKey
  if (catalogData.length > 0) {
    result = leftJoin(
      result,
      catalogData,
      (r) => r.ProductSKU,
      (r) => r.ProductKey,
    );
  }

  return result;
}

// ── Phase E: Final Enrichment ───────────────────────────────────────────────

export function finalEnrichment(
  joinedRows: Record<string, any>[],
  dispensaryLicense: string,
): InventoryDerivedRow[] {
  // Step 1: Blank Units -> "0"
  for (const row of joinedRows) {
    if (!row.Units || row.Units === '') {
      row.Units = '0';
    }
  }

  // Step 2: Row numbers partitioned by ExternalPackageId
  const partitions = groupBy(joinedRows, (r) => r.ExternalPackageId ?? '');
  for (const [, rows] of partitions) {
    let num = 1;
    for (const row of rows) {
      row._rowNumber = num++;
    }
  }

  // Steps 3-6: Build final InventoryDerivedRow for each row
  return joinedRows.map((row) => {
    const extPkgId = row.ExternalPackageId ?? '';
    const productCategory = row.ProductCategory ?? row.Category ?? '';
    const isMerch = productCategory === 'Merch';
    const rowNum = row._rowNumber ?? 1;

    // TraceTreezId
    const traceTreezId = isMerch
      ? `${extPkgId}-${rowNum}`
      : extPkgId;

    // InventoryBarcodes
    const inventoryBarcodes = isMerch ? '' : extPkgId;

    // Date formatting
    const receiveDate = formatDateToISO(row.ReceiveDate ?? '');
    const harvestDate = formatDateToISO(row.HarvestDate ?? '');
    const expirationDate = formatDateToISO(row.ExpirationDate ?? '');
    const packagedDate = formatDateToISO(row.PackagedDate ?? '');

    const productSKU = row.ProductSKU ?? '';

    return {
      // Identity
      treezVariantId: '',
      variantReferenceId: `V-${productSKU}`,
      dispensaryLicense,
      // Invoice
      invoiceId: row.InvoiceId ?? '',
      invoiceCreatedDate: receiveDate,
      manifestNumber: '',
      // Trace
      traceTreezId,
      inventoryBarcodes,
      // Quantities
      originalUnitCount: row.Quantity ?? '',
      units: row.Units ?? '0',
      unitCost: row.UnitCost ?? '',
      // Dates
      harvestDate,
      expirationDate,
      packagedDate,
      // Customer / Location
      customerType: row.customerType ?? '',
      thcAmount: row.thcAmount ?? '',
      thcUom: row.thcUom ?? '',
      cbdAmount: row.cbdAmount ?? '',
      cbdUom: row.cbdUom ?? '',
      locationPath: row.locationPath ?? '',
      locationInventoryType: row.locationInventoryType ?? '',
      locationIsSellable: row.locationIsSellable ?? '',
      locationDefaultReceivingLocation: row.locationDefaultReceivingLocation ?? '',
      // Distributor
      distributorName: row.distributorName ?? '',
      distributorDBA: row.distributorDBA ?? '',
      distributorAddress: row.distributorAddress ?? '',
      distributorPhoneNumber: row.distributorPhoneNumber ?? '',
      distributorEmail: row.distributorEmail ?? '',
      distributorType: row.distributorType ?? '',
      distributorDefaultPaymentTerm: row.distributorDefaultPaymentTerm ?? '',
      distributorLeadTime: row.distributorLeadTime ?? '',
      distributorDeliveryDays: row.distributorDeliveryDays ?? '',
      distributorPreferredPaymentMethod: row.distributorPreferredPaymentMethod ?? '',
      distributorLicense1Type: row.distributorLicense1Type ?? '',
      distributorLicense1Number: row.distributorLicense1Number ?? '',
      distributorLicense1ExpirationDate: row.distributorLicense1ExpirationDate ?? '',
      distributorLicense2Type: row.distributorLicense2Type ?? '',
      distributorLicense2Number: row.distributorLicense2Number ?? '',
      distributorLicense2ExpirationDate: row.distributorLicense2ExpirationDate ?? '',
      distributorLicense3Type: row.distributorLicense3Type ?? '',
      distributorLicense3Number: row.distributorLicense3Number ?? '',
      distributorLicense3ExpirationDate: row.distributorLicense3ExpirationDate ?? '',
      distributorRep1Name: row.distributorRep1Name ?? '',
      distributorRep1Phone: row.distributorRep1Phone ?? '',
      distributorRep1Email: row.distributorRep1Email ?? '',
      distributorRep1Role: row.distributorRep1Role ?? '',
      distributorRep1Notes: row.distributorRep1Notes ?? '',
      distributorRep2Name: row.distributorRep2Name ?? '',
      distributorRep2Phone: row.distributorRep2Phone ?? '',
      distributorRep2Email: row.distributorRep2Email ?? '',
      distributorRep2Role: row.distributorRep2Role ?? '',
      distributorRep2Notes: row.distributorRep2Notes ?? '',
      distributorRep3Name: row.distributorRep3Name ?? '',
      distributorRep3Phone: row.distributorRep3Phone ?? '',
      distributorRep3Email: row.distributorRep3Email ?? '',
      distributorRep3Role: row.distributorRep3Role ?? '',
      distributorRep3Notes: row.distributorRep3Notes ?? '',
      // Internal
      productSKU,
      externalPackageId: extPkgId,
      productCategory,
      excluded: false,
      _rowNumber: rowNum,
    };
  });
}

// ── Orchestrator: runInventoryETL ───────────────────────────────────────────

export function runInventoryETL(
  input: ETLInput,
  mappings: PerRoleMappings,
  dispensaryLicense: string,
): InventoryDerivedRow[] {
  // Phase C: Always process inventory
  const inventoryData = processInventory(input.inventoryFile.rows, mappings.inventory);

  // Build set of inventory ExternalPackageIds for active invoice filter
  const inventoryExtPkgIds = new Set<string>(inventoryData.map((r) => r.ExternalPackageId));

  // Phase A: Process receipts if available
  let invoiceData: InvoiceRow[] = [];
  if (input.receiptsFile && input.receiptsFile.rows.length > 0) {
    const adjRows = input.adjustmentsFile?.rows ?? [];
    invoiceData = processReceipts(
      input.receiptsFile.rows,
      adjRows,
      inventoryExtPkgIds,
      mappings.receipts,
      mappings.adjustments,
    );
  }

  // Phase B: Process vendors if available
  let distributorData: Record<string, DistributorInfo> = {};
  if (input.vendorsFile && input.vendorsFile.rows.length > 0) {
    distributorData = processVendors(input.vendorsFile.rows, mappings.vendors);
  }

  // Catalog data
  let catalogData: { ProductKey: string; ProductCategory: string }[] = [];
  if (input.catalogFile && input.catalogFile.rows.length > 0) {
    const catMap = buildFieldMap(mappings.catalog_export);
    catalogData = input.catalogFile.rows.map((row) => ({
      ProductKey: getVal(row, catMap, 'cat_productKey'),
      ProductCategory: getVal(row, catMap, 'cat_productCategory'),
    }));
  }

  // Phase D: Join chain
  const joined = joinChain(inventoryData, invoiceData, distributorData, catalogData);

  // Phase E: Final enrichment
  return finalEnrichment(joined, dispensaryLicense);
}
