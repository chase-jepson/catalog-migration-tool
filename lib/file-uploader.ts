import { arrayToCSV } from './csv-generator';
import type { OutputCSVs, ImportObjectType } from './types';
import { OUTPUT_FILE_ORDER, OUTPUT_FILE_LABELS } from './types';

/**
 * Object type identifiers expected by the Treez file-management API.
 * Maps our internal keys to the API's import object type strings.
 */
export const API_OBJECT_TYPES: Record<ImportObjectType, string> = {
  brands: 'PRODUCT_BRAND_IMPORT',
  attributes: 'PRODUCT_ATTRIBUTE_IMPORT',
  products: 'PRODUCT_IMPORT',
  variants: 'PRODUCT_VARIANT_IMPORT',
  attributeJoins: 'PRODUCT_ATTRIBUTE_JOIN_IMPORT',
  images: 'PRODUCT_VARIANT_IMAGE_IMPORT',
};

/**
 * Build a CSV upload payload from a 2D string array.
 * Converts the data to a CSV string and computes byte length.
 */
export function buildUploadPayload(
  data: string[][],
  _fileName: string,
): { csvContent: string; contentLength: number } {
  const csvContent = arrayToCSV(data);
  const contentLength = new TextEncoder().encode(csvContent).byteLength;
  return { csvContent, contentLength };
}

/**
 * Get the ordered sequence of files to upload, skipping any that are empty
 * (header only, no data rows).
 */
export function getUploadSequence(
  csvs: OutputCSVs,
): { key: ImportObjectType; label: string; data: string[][] }[] {
  const sequence: { key: ImportObjectType; label: string; data: string[][] }[] = [];

  for (const key of OUTPUT_FILE_ORDER) {
    const data = csvs[key];
    // Skip files that only have a header row (no data)
    if (data.length <= 1) continue;

    sequence.push({
      key,
      label: OUTPUT_FILE_LABELS[key],
      data,
    });
  }

  return sequence;
}
