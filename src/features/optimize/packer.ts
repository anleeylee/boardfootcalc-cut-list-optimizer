/**
 * packer.ts — Purchase plan optimization.
 *
 * This is a 1D cutting-stock heuristic over whole boards. Boards are bought
 * whole, so the optimizer works on "usable length per board" and decides
 * which boards to buy and which parts go on each.
 *
 * Strategies (all explainable, no black boxes):
 *   lowest-cost   — reuse already-selected boards first, then the cheapest
 *                   compatible board that fits.
 *   lowest-waste  — reuse boards first (densest fit), then the smallest
 *                   compatible board that fits, to minimize purchased BF.
 *   min-boards    — reuse boards first, then the LONGEST compatible board,
 *                   so one board absorbs as many parts as possible.
 *   balanced      — weighted score: cost 50%, volume 30%, leftover 20%.
 *
 * Kerf is consumed between every pair of pieces on a board — never ignored.
 */

import { boardFootInches, roundTo } from '../../core';
import { compatibilityReason, resolveOrientation, usableLength } from './matching';
import type {
  BoardInput,
  BoardPlan,
  OptimizeSettings,
  OptimizationResult,
  OptimizeStrategy,
  PartItem,
  UnfulfilledPart,
} from './types';

interface Candidate extends BoardInput {
  usable: number;
  bf: number;
  totalCost: number;
}

/** Sort parts by strategy. Long/hard parts are placed first. */
export function sortItems(parts: PartItem[], strategy: OptimizeStrategy): PartItem[] {
  const sorted = [...parts];
  switch (strategy) {
    case 'balanced':
      sorted.sort((a, b) => b.widthIn * b.lengthIn - a.widthIn * a.lengthIn);
      break;
    default:
      sorted.sort((a, b) => b.lengthIn - a.lengthIn);
      break;
  }
  return sorted;
}

/** Total length consumed on a board: pieces plus kerf between them. */
function planUsedLength(plans: BoardPlan[], boardId: string, kerf: number): number {
  const plan = plans.find((p) => p.board.boardId === boardId);
  if (!plan) return 0;
  const sum = plan.placements.reduce((s, pl) => s + pl.lengthIn, 0);
  return sum + Math.max(0, plan.placements.length - 1) * kerf;
}

export function optimize(
  parts: PartItem[],
  boards: BoardInput[],
  strategy: OptimizeStrategy,
  settings: OptimizeSettings,
): OptimizationResult {
  const kerf = Math.max(0, settings.kerf);
  const tolerance = settings.toleranceIn ?? 0.001;

  const candidates: Candidate[] = boards
    .filter((b) => b.source === 'supplier' || b.status.toUpperCase() === 'AVAILABLE')
    .filter((b) => b.lengthIn > 0 && b.widthIn > 0)
    .map((b) => {
      const bf = boardFootInches(b);
      return { ...b, usable: usableLength(b), bf, totalCost: b.costPerBF * bf + b.fixedCost };
    });

  const plans: BoardPlan[] = [];
  const unfulfilled: UnfulfilledPart[] = [];
  const items = sortItems(parts, strategy);

  let placedQuantity = 0;
  const totalRequiredQuantity = parts.reduce((s, p) => s + p.quantity, 0);

  /** Boards already selected that can still take this item (densest first). */
  function existingFit(part: PartItem): Candidate[] {
    const result: Candidate[] = [];
    for (const plan of plans) {
      const c = plan.board as Candidate;
      const orient = resolveOrientation(part, c);
      if (!orient) continue;
      const used = planUsedLength(plans, c.boardId, kerf);
      const need = orient.lengthIn + (used > 0 ? kerf : 0);
      if (c.usable - used + tolerance >= need) result.push(c);
    }
    result.sort((a, b) => {
      const ra = a.usable - planUsedLength(plans, a.boardId, kerf);
      const rb = b.usable - planUsedLength(plans, b.boardId, kerf);
      return ra - rb;
    });
    return result;
  }

  /** Compatible, not-yet-bought boards that can fit this item. */
  function newFit(part: PartItem): Candidate[] {
    const result: Candidate[] = [];
    for (const c of candidates) {
      if (plans.some((p) => p.board.boardId === c.boardId)) continue;
      if (compatibilityReason(part, c)) continue;
      const orient = resolveOrientation(part, c);
      if (!orient) continue;
      if (c.usable + tolerance >= orient.lengthIn) result.push(c);
    }
    return result;
  }

  function pickExisting(part: PartItem): Candidate | null {
    const pool = existingFit(part);
    return pool.length > 0 ? pool[0] : null;
  }

  function pickNew(part: PartItem): Candidate | null {
    const pool = newFit(part);
    if (pool.length === 0) return null;
    switch (strategy) {
      case 'lowest-cost':
        pool.sort((a, b) => a.totalCost - b.totalCost || b.usable - a.usable);
        break;
      case 'lowest-waste':
        pool.sort((a, b) => a.bf - b.bf || a.totalCost - b.totalCost);
        break;
      case 'min-boards':
        pool.sort((a, b) => b.usable - a.usable || a.totalCost - b.totalCost);
        break;
      case 'balanced': {
        const maxCost = Math.max(...pool.map((c) => c.totalCost), 1e-9);
        const maxBf = Math.max(...pool.map((c) => c.bf), 1e-9);
        const maxUsable = Math.max(...pool.map((c) => c.usable), 1e-9);
        pool.sort((a, b) => {
          const score = (c: Candidate) =>
            0.5 * (c.totalCost / maxCost) + 0.3 * (c.bf / maxBf) + 0.2 * (1 - c.usable / maxUsable);
          return score(a) - score(b);
        });
        break;
      }
    }
    return pool[0];
  }

  function place(part: PartItem, board: Candidate): void {
    const orient = resolveOrientation(part, board)!;
    const plan = plans.find((p) => p.board.boardId === board.boardId);
    if (plan) {
      const used = planUsedLength(plans, board.boardId, kerf);
      const prev = plan.placements[plan.placements.length - 1];
      if (prev) prev.kerfAfter = true;
      plan.placements.push({
        partId: part.partId,
        partName: part.partName,
        index: plan.placements.length + 1,
        startIn: roundTo(used, 0.001),
        lengthIn: orient.lengthIn,
        widthIn: orient.widthIn,
        rotated: orient.rotated,
        kerfAfter: false,
      });
    } else {
      plans.push({
        board,
        placements: [
          {
            partId: part.partId,
            partName: part.partName,
            index: 1,
            startIn: 0,
            lengthIn: orient.lengthIn,
            widthIn: orient.widthIn,
            rotated: orient.rotated,
            kerfAfter: false,
          },
        ],
        usableLengthIn: board.usable,
        usedLengthIn: orient.lengthIn,
        boardBF: board.bf,
        usedBF: 0,
        wasteBF: 0,
        wastePct: 0,
        partsSummary: [],
        explanation: [],
      });
    }
  }

  for (const part of items) {
    let remainingQty = part.quantity;
    while (remainingQty > 0) {
      let board: Candidate | null = pickExisting(part);
      if (!board) board = pickNew(part);
      if (!board) {
        unfulfilled.push({
          partId: part.partId,
          partName: part.partName,
          quantity: remainingQty,
          species: part.species,
          thicknessIn: part.thicknessIn,
          widthIn: part.widthIn,
          lengthIn: part.lengthIn,
          reason: explainUnfulfilled(part, candidates, tolerance),
        });
        break;
      }
      place(part, board);
      placedQuantity += 1;
      remainingQty -= 1;
    }
  }

  return summarize(plans, unfulfilled, items, strategy, settings, placedQuantity, totalRequiredQuantity);
}

function explainUnfulfilled(part: PartItem, candidates: Candidate[], tolerance: number): string {
  if (candidates.length === 0) {
    return 'No boards available — inventory is empty and no supplier stock was imported';
  }
  const sameSpecies = candidates.filter((c) => c.species.trim().toLowerCase() === part.species.trim().toLowerCase());
  if (sameSpecies.length === 0) {
    return `No ${part.species} boards available (found: ${[...new Set(candidates.map((c) => c.species))].join(', ') || 'none'})`;
  }
  const maxUsable = Math.max(...sameSpecies.map((c) => c.usable));
  if (part.lengthIn > maxUsable + tolerance) {
    return `Part length ${part.lengthIn}" exceeds the longest compatible board (${maxUsable.toFixed(2)}" usable)`;
  }
  return `No ${part.species} board has enough remaining width/length for ${part.widthIn}"×${part.lengthIn}" (width, grain or kerf constraint)`;
}

function summarize(
  plans: BoardPlan[],
  unfulfilled: UnfulfilledPart[],
  allItems: PartItem[],
  strategy: OptimizeStrategy,
  settings: OptimizeSettings,
  placedQuantity: number,
  totalRequiredQuantity: number,
): OptimizationResult {
  const netRequiredBF = allItems.reduce((s, p) => s + boardFootInches(p) * p.quantity, 0);
  let purchasedBF = 0;
  let estimatedCost = 0;
  let usedInventoryBF = 0;
  let newPurchaseBF = 0;
  let usedInventoryCost = 0;
  let newPurchaseCost = 0;
  let inventoryBoardCount = 0;
  let newBoardCount = 0;

  for (const plan of plans) {
    const used = plan.placements.reduce(
      (s, pl) => s + boardFootInches({ thicknessIn: plan.board.thicknessIn, widthIn: pl.widthIn, lengthIn: pl.lengthIn }),
      0,
    );
    const usedLength =
      plan.placements.reduce((s, pl) => s + pl.lengthIn, 0) +
      Math.max(0, plan.placements.length - 1) * settings.kerf;
    const waste = Math.max(0, plan.boardBF - used);

    plan.usedLengthIn = usedLength;
    plan.usedBF = used;
    plan.wasteBF = waste;
    plan.wastePct = plan.boardBF > 0 ? (waste / plan.boardBF) * 100 : 0;

    const summary = new Map<string, { partName: string; quantity: number }>();
    for (const pl of plan.placements) {
      const hit = summary.get(pl.partId);
      if (hit) hit.quantity += 1;
      else summary.set(pl.partId, { partName: pl.partName, quantity: 1 });
    }
    plan.partsSummary = [...summary.entries()].map(([partId, v]) => ({ partId, partName: v.partName, quantity: v.quantity }));

    purchasedBF += plan.boardBF;
    estimatedCost += plan.board.totalCost;
    if (plan.board.source === 'inventory') {
      usedInventoryBF += plan.board.bf;
      usedInventoryCost += plan.board.totalCost;
      inventoryBoardCount += 1;
    } else {
      newPurchaseBF += plan.board.bf;
      newPurchaseCost += plan.board.totalCost;
      newBoardCount += 1;
    }
  }

  const usedBF = plans.reduce((s, plan) => s + plan.usedBF, 0);

  return {
    strategy,
    settings,
    plans,
    unfulfilled,
    netRequiredBF,
    purchasedBF,
    usedInventoryBF,
    newPurchaseBF,
    wasteBF: Math.max(0, purchasedBF - usedBF),
    yieldPct: purchasedBF > 0 ? (usedBF / purchasedBF) * 100 : 0,
    estimatedCost,
    usedInventoryCost,
    newPurchaseCost,
    boardCount: plans.length,
    inventoryBoardCount,
    newBoardCount,
    placedQuantity,
    totalRequiredQuantity,
  };
}
