/**
 * boards.ts — Available board import (existing inventory and supplier stock).
 *
 * Board fields per spec: Board ID, Species, Grade, Thickness, Width, Length,
 * BF, Cost/BF, Fixed Cost, Location, Grain Direction, Defect Zones, Status.
 * BF is recomputed by the shared engine and never trusted from the file.
 */

import { z } from 'zod';
import {
  boardFootInches,
  friendlyZodError,
  mapHeaders,
  parseDecimal,
  parseDimension,
  parseThickness,
  cell,
} from '../core';
import { readTableFile, writeTableFile } from './io';
import type { BoardInput } from './optimize/types';

const BOARD_SYNONYMS: Record<string, string[]> = {
  boardId: ['boardid', 'board id', 'id', 'board', 'stock id'],
  species: ['species', 'wood', 'wood species', 'material'],
  grade: ['grade', 'select', 'fas'],
  thicknessIn: ['thickness', 'thk', 't', 'thickness (in)'],
  widthIn: ['width', 'wdth', 'w', 'width (in)'],
  lengthIn: ['length', 'len', 'l', 'length (in)', 'length (ft)'],
  costPerBF: ['cost/bf', 'cost per bf', 'price/bf', '$/bf', 'price', 'unit price'],
  fixedCost: ['fixed cost', 'setup', 'handling', 'per board'],
  location: ['location', 'rack', 'bin', 'shelf', 'where'],
  grainDirection: ['grain', 'grain direction'],
  defectZones: ['defects', 'defect zones', 'defect'],
  status: ['status', 'state'],
  bf: ['bf', 'board feet', 'bd ft'],
};

export interface BoardImportResult {
  boards: BoardInput[];
  skipped: { row: number; reason: string }[];
  warnings: string[];
}

export function parseBoardRows(rows: string[][], defaultSource: BoardInput['source'] = 'supplier'): BoardImportResult {
  if (rows.length < 2) return { boards: [], skipped: [{ row: 1, reason: 'No data rows' }], warnings: [] };
  const headers = rows[0];
  const { mapping, unmapped } = mapHeaders(headers, BOARD_SYNONYMS);
  const warnings: string[] = [];
  for (const field of unmapped) {
    if (['grade', 'location', 'grainDirection', 'defectZones', 'status', 'fixedCost', 'bf'].includes(field)) continue;
    warnings.push(`Column not found: "${field}"`);
  }

  const boards: BoardInput[] = [];
  const skipped: BoardImportResult['skipped'] = [];

  rows.slice(1).forEach((rawRow, idx) => {
    const rowIndex = idx + 2;
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = rawRow[i] ?? '';
    });

    const boardId = cell(row, mapping, 'boardId');
    if (!boardId) {
      skipped.push({ row: rowIndex, reason: 'Missing Board ID' });
      return;
    }
    const species = cell(row, mapping, 'species');
    if (!species) {
      skipped.push({ row: rowIndex, reason: `Missing species for board ${boardId}` });
      return;
    }
    try {
      const thickness = parseThickness(cell(row, mapping, 'thicknessIn')).thicknessIn;
      const width = parseDimension(cell(row, mapping, 'widthIn')).inches;
      const length = parseDimension(cell(row, mapping, 'lengthIn')).inches;

      const rawDefects = cell(row, mapping, 'defectZones');
      const defects = rawDefects
        ? rawDefects
            .split(';')
            .map((zone) => zone.trim())
            .filter(Boolean)
            .map((zone) => {
              // format: x,y,width,length in inches, e.g. "30,2,8,4"
              const [x, y, w, l] = zone.split(',').map((v) => Number(parseDecimal(v)));
              if ([x, y, w, l].some((v) => !Number.isFinite(v) || v! < 0)) {
                throw new Error(`Invalid defect zone "${zone}" (expected x,y,width,length)`);
              }
              return { x: x as number, y: y as number, width: w as number, length: l as number };
            })
        : [];

      const status = cell(row, mapping, 'status').toUpperCase() || 'AVAILABLE';
      const board: BoardInput = {
        boardId,
        species,
        grade: cell(row, mapping, 'grade'),
        thicknessIn: thickness,
        widthIn: width,
        lengthIn: length,
        costPerBF: parseDecimal(cell(row, mapping, 'costPerBF')) ?? 0,
        fixedCost: parseDecimal(cell(row, mapping, 'fixedCost')) ?? 0,
        location: cell(row, mapping, 'location'),
        grainDirection: ['vertical', 'horizontal'].includes(cell(row, mapping, 'grainDirection').toLowerCase())
          ? (cell(row, mapping, 'grainDirection').toLowerCase() as 'vertical' | 'horizontal')
          : 'any',
        defects,
        status,
        source: defaultSource,
        bf: 0,
        totalCost: 0,
      };
      board.bf = boardFootInches(board);
      board.totalCost = board.bf * board.costPerBF + board.fixedCost;
      boards.push(board);
    } catch (err) {
      const reason = err instanceof z.ZodError ? friendlyZodError(err) : (err as Error).message;
      skipped.push({ row: rowIndex, reason: `${boardId}: ${reason}` });
    }
  });

  return { boards, skipped, warnings };
}

export function importBoardsFile(path: string, defaultSource: BoardInput['source'] = 'supplier'): BoardImportResult {
  return parseBoardRows(readTableFile(path), defaultSource);
}

export function boardsToRows(boards: BoardInput[]): (string | number)[][] {
  const head = ['Board ID', 'Species', 'Grade', 'Thickness', 'Width', 'Length', 'BF', 'Cost/BF', 'Fixed Cost', 'Total Cost', 'Location', 'Grain', 'Status', 'Source'];
  const rows: (string | number)[][] = [head];
  for (const b of boards) {
    rows.push([
      b.boardId,
      b.species,
      b.grade,
      b.thicknessIn,
      b.widthIn,
      b.lengthIn,
      round3(b.bf),
      b.costPerBF,
      b.fixedCost,
      round2(b.totalCost),
      b.location,
      b.grainDirection,
      b.status,
      b.source,
    ]);
  }
  return rows;
}

export function exportBoardsFile(path: string, boards: BoardInput[]): void {
  writeTableFile(path, boardsToRows(boards), 'Boards');
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
