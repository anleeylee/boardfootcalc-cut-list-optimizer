/**
 * boardfoot.ts — Board foot math, nominal/actual sizing, dealer billing
 * (rounding) profiles, and yield/waste helpers.
 *
 * One board foot = 144 cubic inches = thickness(in) × width(in) × length(in) / 144.
 * In feet: thickness(in) × width(in) × length(ft) / 12.
 */

import { CUBIC_INCHES_PER_BOARD_FOOT, INCHES_PER_FOOT, nominalThicknessFromActual, roundTo } from './units';

export interface DimensionsIn {
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
}

export interface DimensionsFeet {
  thicknessIn: number;
  widthIn: number;
  lengthFt: number;
}

/** BF from inch dimensions. */
export function boardFootInches(d: DimensionsIn): number {
  return (d.thicknessIn * d.widthIn * d.lengthIn) / CUBIC_INCHES_PER_BOARD_FOOT;
}

/** BF when the length is given in feet. */
export function boardFootFeet(d: DimensionsFeet): number {
  return (d.thicknessIn * d.widthIn * d.lengthFt) / INCHES_PER_FOOT;
}

/** Board feet for a quantity of identical pieces. */
export function boardFootForQuantity(d: DimensionsIn, quantity: number): number {
  return boardFootInches(d) * quantity;
}

export interface NominalActual {
  nominalT: number;
  nominalW: number;
  actualT: number;
  actualW: number;
}

/**
 * Common softwood nominal -> actual pairs (softwood is priced/sold by nominal
 * dimension; actual is the dressed size). "2x4" -> 1.5 × 3.5.
 */
export const NOMINAL_SOFTWOOD_TABLE: Record<string, { actualT: number; actualW: number }> = {
  '1x2': { actualT: 0.75, actualW: 1.5 },
  '1x3': { actualT: 0.75, actualW: 2.5 },
  '1x4': { actualT: 0.75, actualW: 3.5 },
  '1x6': { actualT: 0.75, actualW: 5.5 },
  '1x8': { actualT: 0.75, actualW: 7.25 },
  '1x10': { actualT: 0.75, actualW: 9.25 },
  '1x12': { actualT: 0.75, actualW: 11.25 },
  '2x2': { actualT: 1.5, actualW: 1.5 },
  '2x3': { actualT: 1.5, actualW: 2.5 },
  '2x4': { actualT: 1.5, actualW: 3.5 },
  '2x6': { actualT: 1.5, actualW: 5.5 },
  '2x8': { actualT: 1.5, actualW: 7.25 },
  '2x10': { actualT: 1.5, actualW: 9.25 },
  '2x12': { actualT: 1.5, actualW: 11.25 },
  '4x4': { actualT: 3.5, actualW: 3.5 },
  '4x6': { actualT: 3.5, actualW: 5.5 },
};

export interface SoftwoodNominal {
  nominal: string;
  actualT: number;
  actualW: number;
}

/** Resolve "2x4" into nominal + actual; returns null for unknown sizes. */
export function softwoodNominal(label: string): NominalActual | null {
  const key = label.toLowerCase().replace(/[^0-9x×]/g, '');
  const hit = NOMINAL_SOFTWOOD_TABLE[key];
  if (!hit) return null;
  const m = /^(\d+)x(\d+)$/.exec(key)!;
  return {
    nominalT: Number(m[1]),
    nominalW: Number(m[2]),
    actualT: hit.actualT,
    actualW: hit.actualW,
  };
}

/**
 * Hardwood is sold by **actual measured** dimension, with thickness rounded
 * UP to the next quarter inch for billing (e.g. 13/16" bills as 4/4 = 1").
 * This table maps a nominal quarter thickness to its common surfaced (S2S)
 * thickness. Values are common trade conventions, not legal specs.
 */
export const S2S_THICKNESS_BY_QUARTER: Record<number, number> = {
  4: 0.75, // 4/4 -> 3/4" S2S
  5: 1.0, //  5/4 -> 1"
  6: 1.125, // 6/4 -> 1-1/8"
  8: 1.5, //  8/4 -> 1-1/2"
  10: 1.875, // 10/4 -> 1-7/8"
  12: 2.25, // 12/4 -> 2-1/4"
  16: 3.0, //  16/4 -> 3"
};

export function s2sThicknessInches(quarter: number): number | null {
  return S2S_THICKNESS_BY_QUARTER[quarter] ?? null;
}

/** The nominal (billing) thickness for a measured thickness, in inches. */
export function nominalBillingThickness(measuredIn: number): number {
  return nominalThicknessFromActual(measuredIn);
}

// ---------------------------------------------------------------------------
// Dealer rounding / billing profiles
// ---------------------------------------------------------------------------

export type RoundScope = 'none' | 'piece' | 'line' | 'tally';
export type RoundMethod = 'nearest' | 'ceil' | 'floor';

export interface RoundingRule {
  scope: RoundScope;
  method: RoundMethod;
  /** 1 = whole BF, 0.1 = tenth of a BF, 0.001 = exact-ish. */
  precision: number;
}

export interface BillingProfile {
  id: string;
  name: string;
  description: string;
  /** How the billed thickness is derived from the measured thickness. */
  thicknessMode: 'actual' | 'nominal';
  /** Whether the length is first rounded to a whole foot before BF (common on tallies). */
  lengthMode: 'exact' | 'wholeFoot';
  rounding: RoundingRule;
}

export const BILLING_PROFILES: BillingProfile[] = [
  {
    id: 'exact',
    name: 'Exact BF (no rounding)',
    description: 'Thickness × width × length ÷ 144, no rounding at any stage.',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'none', method: 'nearest', precision: 0.001 },
  },
  {
    id: 'whole-bf-per-piece',
    name: 'Whole BF per piece',
    description: 'Each board is rounded to the nearest whole board foot before the line total.',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'piece', method: 'nearest', precision: 1 },
  },
  {
    id: 'whole-bf-per-piece-ceil',
    name: 'Whole BF per piece (round up)',
    description: 'Each board is rounded UP to the next whole board foot (some yards bill this way).',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'piece', method: 'ceil', precision: 1 },
  },
  {
    id: 'whole-bf-per-line',
    name: 'Whole BF per tally line',
    description: 'The line total (BF × qty) is rounded to the nearest whole board foot.',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'line', method: 'nearest', precision: 1 },
  },
  {
    id: 'tenth-bf-per-piece',
    name: 'Tenth of BF per piece',
    description: 'Each board is rounded to one decimal place before the line total.',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'piece', method: 'nearest', precision: 0.1 },
  },
  {
    id: 'tally-whole',
    name: 'Whole BF on tally total',
    description: 'All lines are summed exactly, then the final tally is rounded to a whole board foot.',
    thicknessMode: 'actual',
    lengthMode: 'exact',
    rounding: { scope: 'tally', method: 'nearest', precision: 1 },
  },
  {
    id: 'nominal-quarter',
    name: 'Nominal quarter thickness',
    description: 'Thickness is billed at the nominal quarter (4/4, 6/4, 8/4) even when surfaced.',
    thicknessMode: 'nominal',
    lengthMode: 'exact',
    rounding: { scope: 'none', method: 'nearest', precision: 0.001 },
  },
  {
    id: 'whole-foot-length',
    name: 'Whole-foot length rounding',
    description: 'Length is rounded up to the nearest foot before BF (common on softwood tallies).',
    thicknessMode: 'nominal',
    lengthMode: 'wholeFoot',
    rounding: { scope: 'line', method: 'nearest', precision: 1 },
  },
];

export function billingProfileById(id: string): BillingProfile | null {
  return BILLING_PROFILES.find((p) => p.id === id) ?? null;
}

export function roundBF(value: number, rule: RoundingRule): number {
  if (rule.scope === 'none') return value;
  let out: number;
  switch (rule.method) {
    case 'nearest':
      out = roundTo(value, rule.precision);
      break;
    case 'ceil': {
      const factor = 1 / rule.precision;
      out = Math.ceil((value - 1e-9) * factor) / factor;
      break;
    }
    case 'floor': {
      const factor = 1 / rule.precision;
      out = Math.floor((value + 1e-9) * factor) / factor;
      break;
    }
  }
  return out;
}

export interface BillingLineInput {
  thicknessIn: number;
  widthIn: number;
  lengthIn: number;
  quantity: number;
}

export interface BillingLineResult {
  /** BF of one piece using the profile's thickness/length rules, before rounding. */
  rawPieceBF: number;
  /** BF applied to the whole line (qty) before line/tally rounding. */
  rawLineBF: number;
  /** Billed BF for this line after piece/line rounding. */
  billedLineBF: number;
  steps: string[];
}

export interface BillingResult {
  lines: BillingLineResult[];
  totalRawBF: number;
  totalBilledBF: number;
  profile: BillingProfile;
}

/**
 * Apply a billing profile to tally lines. Every line gets a human-readable
 * `steps` trace so the auditor can explain exactly why a number differs.
 */
export function applyBillingProfile(lines: BillingLineInput[], profile: BillingProfile): BillingResult {
  const out: BillingLineResult[] = [];
  let totalRaw = 0;
  let totalBilled = 0;

  for (const line of lines) {
    const steps: string[] = [];
    let thickness = line.thicknessIn;
    if (profile.thicknessMode === 'nominal') {
      thickness = nominalThicknessFromActual(line.thicknessIn);
      if (Math.abs(thickness - line.thicknessIn) > 1e-9) {
        steps.push(`thickness billed at nominal ${thickness}" instead of measured ${line.thicknessIn}"`);
      }
    }
    let length = line.lengthIn;
    if (profile.lengthMode === 'wholeFoot') {
      length = Math.ceil(line.lengthIn / INCHES_PER_FOOT - 1e-9) * INCHES_PER_FOOT;
      if (Math.abs(length - line.lengthIn) > 1e-9) {
        steps.push(`length rounded up to ${length / INCHES_PER_FOOT} ft`);
      }
    }

    const rawPieceBF = (thickness * line.widthIn * length) / CUBIC_INCHES_PER_BOARD_FOOT;
    let billedLineBF: number;

    switch (profile.rounding.scope) {
      case 'piece': {
        const roundedPiece = roundBF(rawPieceBF, profile.rounding);
        billedLineBF = roundedPiece * line.quantity;
        if (Math.abs(roundedPiece - rawPieceBF) > 1e-9) {
          steps.push(
            `each piece ${rawPieceBF.toFixed(3)} BF rounded to ${roundedPiece.toFixed(3)} BF (${profile.rounding.method}, ${profile.rounding.precision} BF)`,
          );
        }
        break;
      }
      case 'line': {
        const rawLine = rawPieceBF * line.quantity;
        billedLineBF = roundBF(rawLine, profile.rounding);
        if (Math.abs(billedLineBF - rawLine) > 1e-9) {
          steps.push(`line total ${rawLine.toFixed(3)} BF rounded to ${billedLineBF.toFixed(3)} BF`);
        }
        break;
      }
      default: {
        billedLineBF = rawPieceBF * line.quantity;
        break;
      }
    }

    const rawLineBF = rawPieceBF * line.quantity;
    totalRaw += rawLineBF;
    totalBilled += billedLineBF;
    out.push({ rawPieceBF, rawLineBF, billedLineBF, steps });
  }

  let totalBilledFinal = totalBilled;
  if (profile.rounding.scope === 'tally') {
    totalBilledFinal = roundBF(totalBilled, profile.rounding);
  }

  return { lines: out, totalRawBF: totalRaw, totalBilledBF: totalBilledFinal, profile };
}

// ---------------------------------------------------------------------------
// Yield / waste
// ---------------------------------------------------------------------------

/** Purchased volume for a net requirement after applying a waste factor (e.g. 0.30 = +30%). */
export function purchaseBFWithWaste(requiredBF: number, wasteFactor: number): number {
  return requiredBF * (1 + wasteFactor);
}

/** Waste volume = purchased − net required (never negative). */
export function wasteBF(purchasedBF: number, netRequiredBF: number): number {
  return Math.max(0, purchasedBF - netRequiredBF);
}

/** Yield % = net required / purchased × 100. */
export function yieldPercent(netRequiredBF: number, purchasedBF: number): number {
  if (purchasedBF <= 0) return netRequiredBF <= 0 ? 100 : 0;
  return (netRequiredBF / purchasedBF) * 100;
}

/** Area of a rectangle in square inches. */
export function areaSqIn(widthIn: number, lengthIn: number): number {
  return widthIn * lengthIn;
}
