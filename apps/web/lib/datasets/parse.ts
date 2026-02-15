import Papa from "papaparse";
import * as XLSX from "xlsx";

const MAX_ROWS = 10_000;
const MAX_COLUMNS = 100;

export interface ParsedColumn {
  name: string;
  type: "numeric" | "categorical" | "date" | "text";
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  columns: ParsedColumn[];
}

/**
 * Parse a CSV buffer into structured rows with auto-detected column types.
 */
export function parseCSV(buffer: Buffer): ParseResult {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // we detect types ourselves
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0]?.message}`);
  }

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) throw new Error("CSV has no headers");
  if (headers.length > MAX_COLUMNS) {
    throw new Error(`Too many columns (${headers.length}). Maximum is ${MAX_COLUMNS}.`);
  }

  const rows = result.data.slice(0, MAX_ROWS);
  if (result.data.length > MAX_ROWS) {
    // Silently truncate — caller can check rowCount vs rows.length
  }

  const columns = detectColumnTypes(headers, rows);

  return {
    headers,
    rows: rows as Record<string, unknown>[],
    rowCount: result.data.length,
    columns,
  };
}

/**
 * Parse an Excel (.xlsx) buffer into structured rows with auto-detected column types.
 */
export function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Excel file has no sheets");

  const sheet = workbook.Sheets[firstSheet]!;
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  if (jsonData.length === 0) throw new Error("Excel sheet is empty");

  const headers = Object.keys(jsonData[0]!);
  if (headers.length > MAX_COLUMNS) {
    throw new Error(`Too many columns (${headers.length}). Maximum is ${MAX_COLUMNS}.`);
  }

  const rows = jsonData.slice(0, MAX_ROWS);

  // Convert all values to strings for consistent type detection
  const stringRows = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const h of headers) {
      const val = row[h];
      out[h] = val === null || val === undefined ? "" : String(val);
    }
    return out;
  });

  const columns = detectColumnTypes(headers, stringRows);

  return {
    headers,
    rows: rows as Record<string, unknown>[],
    rowCount: jsonData.length,
    columns,
  };
}

/**
 * Auto-detect column types from string data.
 * - numeric: >80% of non-empty values parse as a finite number
 * - date: >80% of non-empty values match common date patterns
 * - categorical: everything else (treated as factors)
 */
function detectColumnTypes(
  headers: string[],
  rows: Record<string, string>[]
): ParsedColumn[] {
  return headers.map((name) => {
    const values = rows.map((r) => r[name] ?? "").filter((v) => v.trim() !== "");
    const total = values.length;

    if (total === 0) return { name, type: "text" };

    // Check numeric
    const numericCount = values.filter((v) => {
      const n = Number(v);
      return !isNaN(n) && isFinite(n);
    }).length;

    if (numericCount / total > 0.8) return { name, type: "numeric" };

    // Check date — ISO, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/, // ISO
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // DD/MM/YYYY or MM/DD/YYYY
      /^\d{1,2}-\d{1,2}-\d{2,4}$/, // DD-MM-YYYY
    ];
    const dateCount = values.filter((v) =>
      datePatterns.some((p) => p.test(v.trim()))
    ).length;

    if (dateCount / total > 0.8) return { name, type: "date" };

    return { name, type: "categorical" };
  });
}
