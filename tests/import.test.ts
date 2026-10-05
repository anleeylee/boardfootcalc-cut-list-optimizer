import { describe, expect, it } from 'vitest';
import { parseCutListRows, cutListToRows } from '../src/features/cutlist';
import { parseBoardRows } from '../src/features/boards';

describe('cut list import', () => {
  const csv = [
    ['Part ID', 'Part Name', 'Quantity', 'Species', 'Grade', 'Thickness', 'Width', 'Length'],
    ['T1', 'Top', 2, 'Black Walnut', 'FAS', '8/4', 24, '48'],
    ['S1', 'Side', 1, 'Black Walnut', 'FAS', '1.5', '18', "36-1/2"],
  ].map((r) => r.join(',')).join('\n');

  it('parses fractional inches and quarter thickness', () => {
    const rows = csv.split('\n').map((line) => line.split(','));
    const res = parseCutListRows(rows);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].thicknessIn).toBe(2);
    expect(res.items[1].lengthIn).toBeCloseTo(36.5);
  });

  it('skips rows with missing species and reports why', () => {
    const rows = [
      ['Part ID', 'Species', 'Thickness', 'Width', 'Length'],
      ['A1', 'Black Walnut', '4/4', 6, 48],
      ['A2', '', '4/4', 6, 48],
    ];
    const res = parseCutListRows(rows);
    expect(res.items).toHaveLength(1);
    expect(res.skipped[0].reason).toContain('Missing species');
  });

  it('warns on duplicate part ids but keeps both', () => {
    const rows = [
      ['Part ID', 'Species', 'Thickness', 'Width', 'Length'],
      ['A1', 'Oak', '4/4', 6, 48],
      ['A1', 'Oak', '4/4', 6, 48],
    ];
    const res = parseCutListRows(rows);
    expect(res.items).toHaveLength(2);
    expect(res.warnings.some((w) => w.includes('Duplicate'))).toBe(true);
  });

  it('round-trips export', () => {
    const rows = [
      ['Part ID', 'Species', 'Thickness', 'Width', 'Length'],
      ['A1', 'Oak', '4/4', 6, 48],
    ];
    const res = parseCutListRows(rows);
    const exported = cutListToRows(res.items);
    expect(exported[0]).toContain('Part ID');
    expect(exported[1][0]).toBe('A1');
  });
});

describe('board import', () => {
  it('parses boards and recomputes BF', () => {
    const rows = [
      ['Board ID', 'Species', 'Thickness', 'Width', 'Length', 'Cost/BF'],
      ['B1', 'Black Walnut', '8/4', 12, 96, 12.5],
    ];
    const res = parseBoardRows(rows, 'supplier');
    expect(res.boards).toHaveLength(1);
    const b = res.boards[0];
    expect(b.thicknessIn).toBe(2);
    expect(b.bf).toBeCloseTo((2 * 12 * 96) / 144);
    expect(b.totalCost).toBeCloseTo(((2 * 12 * 96) / 144) * 12.5);
  });

  it('parses defect zones', () => {
    const rows = [
      ['Board ID', 'Species', 'Thickness', 'Width', 'Length', 'Defects'],
      ['B1', 'Oak', '4/4', 8, 96, '30,2,8,4; 60,0,5,3'],
    ];
    const res = parseBoardRows(rows, 'inventory');
    expect(res.boards[0].defects).toHaveLength(2);
    expect(res.boards[0].defects[0].x).toBe(30);
  });

  it('rejects invalid defects', () => {
    const rows = [
      ['Board ID', 'Species', 'Thickness', 'Width', 'Length', 'Defects'],
      ['B1', 'Oak', '4/4', 8, 96, 'abc'],
    ];
    const res = parseBoardRows(rows);
    expect(res.boards).toHaveLength(0);
    expect(res.skipped[0].reason).toContain('defect');
  });
});
