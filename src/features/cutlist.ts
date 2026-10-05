/**
 * cutlist.ts — Cut List import/export.
 *
 * Accepts CSV / XLSX with friendly column synonyms and converts every row to
 * the normalized CutListItem model (dimensions in inches), validating with
 * Zod. Supports the boundary conditions from the spec: fractional inches,
 * mixed units, duplicate parts (warn), missing species (error).
 */

import { z } from 'zod';
import {
  CutListItem,
  cutListItemSchema,
  friendlyZodError,
  mapHeaders,
  parseDecimal,
  parseDimension,
  parseThickness,
  cell,
} from '../core';
import { readTableFile, writeTableFile } from './io';

const CUTLIST_SYNONYMS: Record<string, string[]> = {
  partId: ['partid', 'part id', 'id', 'part'],
  partName: ['partname', 'part name', 'name', 'description', 'desc'],
  quantity: ['quantity', 'qty', 'q', 'count', 'pieces', 'qty needed'],
  species: ['species', 'wood', 'wood species', 'material'],
  grade: ['grade', 'select', 'fas', 'lumber grade'],
  thicknessIn: ['thickness', 'thk', 't', 'thickness (in)', 'thick'],
  widthIn: ['width', 'wdth', 'w', 'width (in)'],
  lengthIn: ['length', 'len', 'l', 'length (in)', 'length (ft)', 'length (mm)'],
  grainDirection: ['grain', 'grain direction', 'grain dir'],
  rotationAllowed: ['rotation', 'rotate', 'rotation allowed'],
  edgeRequirement: ['edge', 'edge requirement', 'edge req'],
  notes: ['notes', 'note', 'comment', 'remarks'],
};

export interface CutListImportResult {
  items: CutListItem[];
  skipped: { row: number; reason: string }[];
  warnings: string[];
}

export function parseCutListRows(rows: string[][], onRow?: (rowIndex: number) => void): CutListImportResult {
  if (rows.length < 2) return { items: [], skipped: [{ row: 1, reason: 'No data rows' }], warnings: [] };
  const headers = rows[0];
  const { mapping, unmapped } = mapHeaders(headers, CUTLIST_SYNONYMS);
  const warnings: string[] = [];
  for (const field of unmapped) {
    if (field === 'grainDirection' || field === 'rotationAllowed' || field === 'edgeRequirement' || field === 'notes' || field === 'grade' || field === 'partName') continue;
    warnings.push(`Column not found: "${field}" (synonyms: ${CUTLIST_SYNONYMS[field].join(', ')})`);
  }

  const items: CutListItem[] = [];
  const skipped: CutListImportResult['skipped'] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((rawRow, idx) => {
    const rowIndex = idx + 2;
    onRow?.(rowIndex);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = rawRow[i] ?? '';
    });

    const partId = cell(row, mapping, 'partId');
    if (!partId) {
      skipped.push({ row: rowIndex, reason: 'Missing Part ID' });
      return;
    }
    const qty = parseDecimal(cell(row, mapping, 'quantity')) ?? 1;
    const species = cell(row, mapping, 'species');
    if (!species) {
      skipped.push({ row: rowIndex, reason: `Missing species for part ${partId}` });
      return;
    }

    try {
      const lengthText = cell(row, mapping, 'lengthIn');
      const length = parseDimension(lengthText).inches;
      const thicknessRaw = cell(row, mapping, 'thicknessIn');
      const thickness = parseThickness(thicknessRaw).thicknessIn;
      const width = parseDimension(cell(row, mapping, 'widthIn')).inches;

      const grainRaw = cell(row, mapping, 'grainDirection').toLowerCase();
      const rotationRaw = cell(row, mapping, 'rotationAllowed').toLowerCase();

      const parsed = cutListItemSchema.parse({
        partId,
        partName: cell(row, mapping, 'partName'),
        quantity: qty,
        species,
        grade: cell(row, mapping, 'grade'),
        thicknessIn: thickness,
        widthIn: width,
        lengthIn: length,
        grainDirection: ['vertical', 'horizontal', 'any'].includes(grainRaw) ? grainRaw : 'any',
        rotationAllowed: ['no', 'false', 'forbidden', '0', 'n'].includes(rotationRaw) ? false : true,
        edgeRequirement: ['one-clean', 'two-clean'].includes(cell(row, mapping, 'edgeRequirement')) ? (cell(row, mapping, 'edgeRequirement') as 'one-clean' | 'two-clean') : 'none',
        notes: cell(row, mapping, 'notes'),
      });
      if (seen.has(partId)) {
        warnings.push(`Duplicate Part ID "${partId}" on row ${rowIndex} — both lines will be kept`);
      }
      seen.add(partId);
      items.push(parsed);
    } catch (err) {
      const reason = err instanceof z.ZodError ? friendlyZodError(err) : (err as Error).message;
      skipped.push({ row: rowIndex, reason: `${partId}: ${reason}` });
    }
  });

  return { items, skipped, warnings };
}

export function cutListToRows(items: CutListItem[]): (string | number)[][] {
  const head = ['Part ID', 'Part Name', 'Quantity', 'Species', 'Grade', 'Thickness', 'Width', 'Length', 'Grain Direction', 'Rotation Allowed', 'Notes'];
  const rows: (string | number)[][] = [head];
  for (const it of items) {
    rows.push([
      it.partId,
      it.partName,
      it.quantity,
      it.species,
      it.grade,
      it.thicknessIn,
      it.widthIn,
      it.lengthIn,
      it.grainDirection,
      it.rotationAllowed ? 'yes' : 'no',
      it.notes,
    ]);
  }
  return rows;
}

export function importCutListFile(path: string): CutListImportResult {
  return parseCutListRows(readTableFile(path));
}

export function exportCutListFile(path: string, items: CutListItem[]): void {
  writeTableFile(path, cutListToRows(items), 'CutList');
}
