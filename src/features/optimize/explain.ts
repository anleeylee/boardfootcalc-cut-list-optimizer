/**
 * explain.ts — Human-readable explanations for the optimizer output.
 *
 * Every board, every placement and every unfulfilled part gets a plain-text
 * "why" so the plan is auditable, not a black box.
 */

import { formatInches, formatQuarterThickness } from '../../core';
import type { BoardPlan, OptimizationResult, UnfulfilledPart } from './types';

function dimLabel(t: number, w: number, l: number): string {
  const q = formatQuarterThickness(t);
  const tLabel = q ? q : `${t}"`;
  return `${tLabel} × ${formatInches(w)}" × ${formatInches(l)}"`;
}

export function explainPlan(plan: BoardPlan): string[] {
  const lines: string[] = [];
  const b = plan.board;
  const source = b.source === 'inventory' ? `inventory (${b.location || 'no location'})` : 'supplier purchase';
  lines.push(
    `Board ${b.boardId} — ${b.species}${b.grade ? ' ' + b.grade : ''}, ${dimLabel(b.thicknessIn, b.widthIn, b.lengthIn)}, ${b.bf.toFixed(2)} BF, ${source}, cost $${b.totalCost.toFixed(2)}`,
  );
  if (b.defects.length > 0) {
    lines.push(`  Defect zones reduce usable length from ${b.lengthIn}" to ${plan.usableLengthIn.toFixed(2)}"`);
  }
  for (const pl of plan.placements) {
    const orient = pl.rotated ? ' (rotated)' : '';
    lines.push(
      `  #${pl.index} ${pl.partName || pl.partId} — ${pl.lengthIn.toFixed(2)}" along board from ${pl.startIn.toFixed(2)}"${orient}${pl.kerfAfter ? ' + kerf' : ''}`,
    );
  }
  lines.push(
    `  Used ${plan.usedLengthIn.toFixed(2)}" of ${b.lengthIn}" (${plan.usedBF.toFixed(2)} BF), waste ${plan.wasteBF.toFixed(2)} BF (${plan.wastePct.toFixed(1)}%)`,
  );
  return lines;
}

export function explainUnfulfilledParts(unfulfilled: UnfulfilledPart[]): string[] {
  return unfulfilled.map(
    (u) => `${u.partId} (${u.partName || 'unnamed'}) ×${u.quantity} — ${u.species} ${dimLabel(u.thicknessIn, u.widthIn, u.lengthIn)}: ${u.reason}`,
  );
}

export function explainResult(result: OptimizationResult): string[] {
  const lines: string[] = [];
  lines.push(`Optimization strategy: ${result.strategy}`);
  lines.push(
    `Net required: ${result.netRequiredBF.toFixed(2)} BF | Purchased: ${result.purchasedBF.toFixed(2)} BF | Waste: ${result.wasteBF.toFixed(2)} BF | Yield: ${result.yieldPct.toFixed(1)}%`,
  );
  lines.push(
    `Boards: ${result.boardCount} (${result.inventoryBoardCount} from inventory, ${result.newBoardCount} new) | Cost: $${result.estimatedCost.toFixed(2)} (inventory $${result.usedInventoryCost.toFixed(2)} + new $${result.newPurchaseCost.toFixed(2)})`,
  );
  lines.push(`Parts placed: ${result.placedQuantity}/${result.totalRequiredQuantity}`);
  return lines;
}

export function printResult(result: OptimizationResult, stream: { write(s: string): void } = process.stdout): void {
  for (const line of explainResult(result)) stream.write(`  ${line}\n`);
  if (result.plans.length > 0) {
    stream.write('\n  Boards:\n');
    for (const plan of result.plans) {
      for (const line of explainPlan(plan)) stream.write(`    ${line}\n`);
    }
  }
  if (result.unfulfilled.length > 0) {
    stream.write('\n  Unfulfilled parts:\n');
    for (const line of explainUnfulfilledParts(result.unfulfilled)) stream.write(`    ${line}\n`);
  } else {
    stream.write('\n  All parts fulfilled.\n');
  }
}
