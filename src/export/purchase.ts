/**
 * purchase.ts — Export the optimization result.
 *
 * Purchase List (CSV/XLSX/JSON) is the document you take to the yard;
 * Cutting Plan (JSON) records which part goes on which board for later use
 * by the Cutting Optimizer.
 */

import { writeFileSync } from 'node:fs';
import { writeTableFile } from '../features/io';
import type { OptimizationResult } from '../features/optimize/types';

export function purchaseListRows(result: OptimizationResult): (string | number)[][] {
  const head = [
    'Board ID',
    'Species',
    'Grade',
    'Thickness',
    'Width',
    'Length',
    'BF',
    'Cost/BF',
    'Fixed Cost',
    'Total Cost',
    'Source',
    'Location',
    'Parts Assigned',
    'Waste BF',
  ];
  const rows: (string | number)[][] = [head];
  for (const plan of result.plans) {
    const parts = plan.partsSummary.map((p) => `${p.partId}×${p.quantity}`).join('; ');
    rows.push([
      plan.board.boardId,
      plan.board.species,
      plan.board.grade,
      plan.board.thicknessIn,
      plan.board.widthIn,
      plan.board.lengthIn,
      r3(plan.boardBF),
      plan.board.costPerBF,
      plan.board.fixedCost,
      r2(plan.board.totalCost),
      plan.board.source,
      plan.board.location,
      parts,
      r2(plan.wasteBF),
    ]);
  }
  return rows;
}

export function cuttingPlanJson(result: OptimizationResult): Record<string, unknown> {
  return {
    format: 'boardfootcalc-cutting-plan',
    version: 1,
    strategy: result.strategy,
    summary: {
      netRequiredBF: r3(result.netRequiredBF),
      purchasedBF: r3(result.purchasedBF),
      wasteBF: r3(result.wasteBF),
      yieldPct: r3(result.yieldPct),
      estimatedCost: r2(result.estimatedCost),
      unfulfilledQuantity: result.unfulfilled.reduce((s, u) => s + u.quantity, 0),
    },
    boards: result.plans.map((plan) => ({
      boardId: plan.board.boardId,
      species: plan.board.species,
      thicknessIn: plan.board.thicknessIn,
      widthIn: plan.board.widthIn,
      lengthIn: plan.board.lengthIn,
      source: plan.board.source,
      placements: plan.placements.map((pl) => ({
        partId: pl.partId,
        partName: pl.partName,
        startIn: pl.startIn,
        lengthIn: pl.lengthIn,
        widthIn: pl.widthIn,
        rotated: pl.rotated,
        kerfAfter: pl.kerfAfter,
      })),
    })),
    unfulfilled: result.unfulfilled.map((u) => ({
      partId: u.partId,
      quantity: u.quantity,
      species: u.species,
      widthIn: u.widthIn,
      lengthIn: u.lengthIn,
      reason: u.reason,
    })),
  };
}

export function exportPurchaseCSV(path: string, result: OptimizationResult): void {
  writeTableFile(path, purchaseListRows(result), 'PurchaseList');
}

export function exportCuttingPlan(path: string, result: OptimizationResult): void {
  writeFileSync(path, JSON.stringify(cuttingPlanJson(result), null, 2), 'utf8');
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
