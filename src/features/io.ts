/**
 * io.ts — CSV / XLSX table I/O shared by the features of this tool.
 * Reads either format into string[][] rows (first row = headers).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname } from 'node:path';
import * as XLSX from 'xlsx';
import { parseCSV, toCSV } from '../core';

export class TableIOError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableIOError';
  }
}

/** Read a .csv/.tsv or .xlsx/.xls file into rows of string cells. */
export function readTableFile(path: string): string[][] {
  if (!existsSync(path)) throw new TableIOError(`File not found: ${path}`);
  const ext = extname(path).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(path);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new TableIOError(`No sheets found in ${path}`);
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    return matrix.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : String(cell))));
  }
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    return parseCSV(readFileSync(path, 'utf8'));
  }
  throw new TableIOError(`Unsupported file type: ${ext} (use .csv or .xlsx)`);
}

/** Write rows to CSV (UTF-8 with BOM so Excel opens it correctly). */
export function writeCSV(path: string, rows: (string | number | null | undefined)[][]): void {
  writeFileSync(path, '\uFEFF' + toCSV(rows), 'utf8');
}

/** Write rows to XLSX. */
export function writeXLSX(path: string, rows: (string | number | null | undefined)[][], sheetName = 'Sheet1'): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows as (string | number)[][]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, path);
}

/** Write rows to either format based on file extension. */
export function writeTableFile(path: string, rows: (string | number | null | undefined)[][], sheetName = 'Sheet1'): void {
  const ext = extname(path).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') writeXLSX(path, rows, sheetName);
  else if (ext === '.csv' || ext === '.tsv' || ext === '.txt') writeCSV(path, rows);
  else throw new TableIOError(`Unsupported output type: ${ext} (use .csv or .xlsx)`);
}
