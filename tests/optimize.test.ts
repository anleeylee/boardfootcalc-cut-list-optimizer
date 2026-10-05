import { describe, expect, it } from 'vitest';
import { optimize, compatibilityReason, resolveOrientation } from '../src/features/optimize';
import type { BoardInput, PartItem } from '../src/features/optimize/types';

function part(overrides: Partial<PartItem> = {}): PartItem {
  return {
    partId: 'P1',
    partName: 'Part',
    quantity: 1,
    species: 'Black Walnut',
    grade: 'FAS',
    thicknessIn: 1,
    widthIn: 6,
    lengthIn: 48,
    grainDirection: 'any',
    rotationAllowed: true,
    edgeRequirement: 'none',
    notes: '',
    ...overrides,
  };
}

function board(overrides: Partial<BoardInput> = {}): BoardInput {
  const b: BoardInput = {
    boardId: 'B1',
    species: 'Black Walnut',
    grade: 'FAS',
    thicknessIn: 1,
    widthIn: 6,
    lengthIn: 96,
    costPerBF: 10,
    fixedCost: 0,
    location: '',
    grainDirection: 'any',
    defects: [],
    status: 'AVAILABLE',
    source: 'supplier',
    bf: 0,
    totalCost: 0,
    ...overrides,
  };
  b.bf = (b.thicknessIn * b.widthIn * b.lengthIn) / 144;
  b.totalCost = b.bf * b.costPerBF + b.fixedCost;
  return b;
}

const settings = { kerf: 0.125, wasteFactor: 0.3, toleranceIn: 0.001 };

describe('compatibility', () => {
  it('rejects wrong species', () => {
    expect(compatibilityReason(part(), board({ species: 'Oak' }))).toContain('Species');
  });

  it('rejects thickness quarter mismatch', () => {
    expect(compatibilityReason(part({ thicknessIn: 1 }), board({ thicknessIn: 2 }))).toContain('Thickness');
  });

  it('rejects width too narrow when grain forbids rotation', () => {
    expect(
      compatibilityReason(part({ widthIn: 8, grainDirection: 'vertical', rotationAllowed: false }), board({ widthIn: 6 })),
    ).toContain('narrow');
  });

  it('allows rotation when the part fits the board width', () => {
    // part 8" wide × 5" long on a 6" board: rotated so the 8" width runs along the board.
    const orient = resolveOrientation(part({ widthIn: 8, lengthIn: 5, rotationAllowed: true }), board({ widthIn: 6 }));
    expect(orient?.rotated).toBe(true);
    expect(orient?.lengthIn).toBe(8);
    expect(orient?.widthIn).toBe(5);
  });
});

describe('purchase optimization', () => {
  it('places one part on one board', () => {
    const res = optimize([part()], [board()], 'lowest-waste', settings);
    expect(res.unfulfilled).toHaveLength(0);
    expect(res.plans).toHaveLength(1);
    expect(res.placedQuantity).toBe(1);
    expect(res.purchasedBF).toBeCloseTo((1 * 6 * 96) / 144);
  });

  it('consumes kerf between parts on one board', () => {
    const res = optimize([part({ partId: 'A', lengthIn: 40 }), part({ partId: 'B', lengthIn: 40 })], [board({ lengthIn: 96 })], 'lowest-waste', settings);
    expect(res.unfulfilled).toHaveLength(0);
    // 40 + 40 + 0.125 kerf = 80.125 <= 96 → one board
    expect(res.plans).toHaveLength(1);
    expect(res.plans[0].placements).toHaveLength(2);
  });

  it('kerf can push a part to another board', () => {
    // Board 96" fits 96" part but not 60 + 36 + kerf.
    const res = optimize(
      [part({ partId: 'A', lengthIn: 60 }), part({ partId: 'B', lengthIn: 36 })],
      [board({ lengthIn: 96 }), board({ boardId: 'B2', lengthIn: 60 })],
      'lowest-waste',
      settings,
    );
    expect(res.plans).toHaveLength(2);
    expect(res.unfulfilled).toHaveLength(0);
  });

  it('reports unfulfilled parts with a reason', () => {
    const res = optimize([part({ lengthIn: 120 })], [board({ lengthIn: 96 })], 'lowest-cost', settings);
    expect(res.unfulfilled).toHaveLength(1);
    expect(res.unfulfilled[0].reason).toContain('longest compatible board');
  });

  it('prefers free inventory boards in lowest-cost mode', () => {
    const res = optimize(
      [part()],
      [board({ boardId: 'SUP', costPerBF: 10 }), board({ boardId: 'INV', source: 'inventory', costPerBF: 0, status: 'AVAILABLE' })],
      'lowest-cost',
      settings,
    );
    expect(res.plans[0].board.source).toBe('inventory');
    expect(res.estimatedCost).toBe(0);
  });

  it('reports yield and waste consistent with the engine', () => {
    const res = optimize([part({ lengthIn: 48 })], [board({ lengthIn: 96 })], 'lowest-waste', settings);
    expect(res.netRequiredBF).toBeCloseTo((1 * 6 * 48) / 144);
    expect(res.purchasedBF).toBeCloseTo((1 * 6 * 96) / 144);
    expect(res.wasteBF).toBeCloseTo((1 * 6 * 48) / 144);
    expect(res.yieldPct).toBeCloseTo(50);
  });

  it('yield stays material-based when parts are unfulfilled', () => {
    // Part needs 48" but is wider than the board: nothing fits.
    const res = optimize([part({ lengthIn: 48, widthIn: 20 })], [board({ lengthIn: 96, widthIn: 6 })], 'lowest-waste', settings);
    expect(res.unfulfilled).toHaveLength(1);
    expect(res.purchasedBF).toBe(0);
    expect(res.wasteBF).toBe(0);
    expect(res.yieldPct).toBe(0);
  });

  it('all four strategies return the same net requirement', () => {
    const parts = [part({ partId: 'A', lengthIn: 40 }), part({ partId: 'B', lengthIn: 30, widthIn: 4 }), part({ partId: 'C', lengthIn: 20 })];
    const boards = [board({ boardId: 'B1', lengthIn: 96, costPerBF: 12 }), board({ boardId: 'B2', lengthIn: 60, costPerBF: 10 })];
    for (const strategy of ['lowest-cost', 'lowest-waste', 'min-boards', 'balanced'] as const) {
      const res = optimize(parts, boards, strategy, settings);
      // (1×6×40 + 1×4×30 + 1×6×20) / 144 = 480/144
      expect(res.netRequiredBF).toBeCloseTo(480 / 144);
      expect(res.unfulfilled).toHaveLength(0);
    }
  });

  it('ignores non-AVAILABLE inventory boards', () => {
    const res = optimize(
      [part()],
      [board({ boardId: 'INV', source: 'inventory', status: 'SOLD' })],
      'lowest-cost',
      settings,
    );
    expect(res.unfulfilled).toHaveLength(1);
  });
});
