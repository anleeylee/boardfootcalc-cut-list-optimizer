/**
 * types.ts — Data model for the purchase optimizer.
 */

import type { CutListItem } from '../../core';

export interface DefectZone {
  x: number;
  y: number;
  width: number;
  length: number;
}

export interface BoardInput {
  boardId: string;
  species: string;
  grade: string;
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
  costPerBF: number;
  fixedCost: number;
  location: string;
  grainDirection: 'vertical' | 'horizontal' | 'any';
  defects: DefectZone[];
  status: string;
  source: 'inventory' | 'supplier';
  /** Recomputed by the engine, never trusted from input. */
  bf: number;
  totalCost: number;
}

/** A part expanded into a single placable item (one piece of the quantity). */
export interface PartItem {
  partId: string;
  partName: string;
  quantity: number;
  species: string;
  grade: string;
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
  grainDirection: 'vertical' | 'horizontal' | 'any';
  rotationAllowed: boolean;
  edgeRequirement: 'none' | 'one-clean' | 'two-clean';
  notes: string;
}

export function itemFromCutList(part: CutListItem): PartItem {
  return {
    partId: part.partId,
    partName: part.partName,
    quantity: part.quantity,
    species: part.species,
    grade: part.grade,
    thicknessIn: part.thicknessIn,
    widthIn: part.widthIn,
    lengthIn: part.lengthIn,
    grainDirection: part.grainDirection,
    rotationAllowed: part.rotationAllowed,
    edgeRequirement: part.edgeRequirement,
    notes: part.notes,
  };
}

export interface Placement {
  partId: string;
  partName: string;
  /** 1-based sequence of the part along the board. */
  index: number;
  /** Start position along the board length (inches). */
  startIn: number;
  /** Length consumed along the board (inches). */
  lengthIn: number;
  widthIn: number;
  rotated: boolean;
  /** True when a kerf cut is needed after this part. */
  kerfAfter: boolean;
}

export interface BoardPlan {
  board: BoardInput;
  placements: Placement[];
  /** Usable length after subtracting defect zones (inches). */
  usableLengthIn: number;
  usedLengthIn: number;
  boardBF: number;
  usedBF: number;
  wasteBF: number;
  wastePct: number;
  /** Parts placed on this board (aggregated by partId). */
  partsSummary: { partId: string; partName: string; quantity: number }[];
  explanation: string[];
}

export interface UnfulfilledPart {
  partId: string;
  partName: string;
  quantity: number;
  species: string;
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
  reason: string;
}

export type OptimizeStrategy = 'lowest-cost' | 'lowest-waste' | 'min-boards' | 'balanced';

export const STRATEGIES: OptimizeStrategy[] = ['lowest-cost', 'lowest-waste', 'min-boards', 'balanced'];

export interface OptimizeSettings {
  kerf: number;
  wasteFactor: number;
  /** Length tolerance (inches) when comparing part vs board length. */
  toleranceIn?: number;
}

export interface OptimizationResult {
  strategy: OptimizeStrategy;
  settings: OptimizeSettings;
  plans: BoardPlan[];
  unfulfilled: UnfulfilledPart[];
  /** Net BF of finished parts (spec definition of "Net Required"). */
  netRequiredBF: number;
  /** Total BF of boards actually used/purchased. */
  purchasedBF: number;
  /** BF of boards drawn from existing inventory. */
  usedInventoryBF: number;
  /** BF of boards that must be newly purchased. */
  newPurchaseBF: number;
  wasteBF: number;
  yieldPct: number;
  estimatedCost: number;
  usedInventoryCost: number;
  newPurchaseCost: number;
  boardCount: number;
  inventoryBoardCount: number;
  newBoardCount: number;
  placedQuantity: number;
  totalRequiredQuantity: number;
}
