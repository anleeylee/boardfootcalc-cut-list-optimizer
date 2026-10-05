/**
 * matching.ts — Species/thickness/width/grain compatibility filtering.
 *
 * A board can receive a part only when all of these hold:
 *   - species compatible (exact name or alias, or "any")
 *   - same nominal thickness quarter (4/4 with 4/4, even if surfaced)
 *   - part width fits the board width (respecting grain orientation)
 *   - grain orientation possible (vertical grain cannot be rotated)
 */

import { nominalThicknessFromActual } from '../../core';
import type { BoardInput, PartItem } from './types';

export interface Orientation {
  lengthIn: number;
  widthIn: number;
  rotated: boolean;
}

export interface Compatibility {
  board: BoardInput;
  orientation: Orientation | null;
  reason: string | null;
}

function quarter(inches: number): number {
  return Math.round(nominalThicknessFromActual(inches) * 4);
}

function speciesCompatible(boardSpecies: string, partSpecies: string): boolean {
  if (partSpecies.toLowerCase() === 'any' || boardSpecies.toLowerCase() === 'any') return true;
  return boardSpecies.trim().toLowerCase() === partSpecies.trim().toLowerCase();
}

/** Return the orientation a part may take on a board, or null with a reason. */
export function resolveOrientation(part: PartItem, board: BoardInput): Orientation | null {
  const bw = board.widthIn;
  // Grain along the part length ("vertical") fixes the orientation.
  if (part.grainDirection === 'vertical') {
    if (part.widthIn <= bw) return { lengthIn: part.lengthIn, widthIn: part.widthIn, rotated: false };
    return null;
  }
  // Grain across the part ("horizontal") means the part's width runs along the board.
  if (part.grainDirection === 'horizontal') {
    if (part.lengthIn <= bw) return { lengthIn: part.widthIn, widthIn: part.lengthIn, rotated: true };
    return null;
  }
  // "any": prefer grain along length; rotate only if needed and allowed.
  if (part.widthIn <= bw) return { lengthIn: part.lengthIn, widthIn: part.widthIn, rotated: false };
  if (part.rotationAllowed && part.lengthIn <= bw) {
    return { lengthIn: part.widthIn, widthIn: part.lengthIn, rotated: true };
  }
  return null;
}

export function compatibilityReason(part: PartItem, board: BoardInput): string | null {
  if (!speciesCompatible(board.species, part.species)) {
    return `Species mismatch (part ${part.species} vs board ${board.species})`;
  }
  const boardQ = quarter(board.thicknessIn);
  const partQ = quarter(part.thicknessIn);
  if (boardQ !== partQ) {
    return `Thickness mismatch (part ${partQ}/4 vs board ${boardQ}/4)`;
  }
  const orient = resolveOrientation(part, board);
  if (!orient) {
    return `Board width ${board.widthIn}" too narrow for part ${part.widthIn}"×${part.lengthIn}" (grain ${part.grainDirection}, rotation ${part.rotationAllowed ? 'allowed' : 'forbidden'})`;
  }
  return null;
}

/** Usable length of a board after subtracting defect zones (projected along length). */
export function usableLength(board: BoardInput): number {
  let loss = 0;
  for (const d of board.defects) {
    loss += Math.max(0, Math.min(d.length, board.lengthIn));
  }
  return Math.max(0, board.lengthIn - loss);
}

export function compatibleBoards(part: PartItem, boards: BoardInput[]): BoardInput[] {
  return boards.filter((b) => compatibilityReason(part, b) === null);
}
