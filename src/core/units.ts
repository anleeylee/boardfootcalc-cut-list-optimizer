/**
 * units.ts — Lumber dimension parsing, conversion and formatting.
 *
 * All internal length math is done in **inches** (floating point).
 * Dimensions may be entered in any supported unit and are normalized here,
 * so the rest of the engine never has to think about units again.
 */

export const INCHES_PER_FOOT = 12;
export const CUBIC_INCHES_PER_BOARD_FOOT = 144;

export type Unit = 'in' | 'ft' | 'mm' | 'cm' | 'm';

/** Multiplier that converts 1 of the given unit into inches. */
export const UNIT_FACTOR_TO_INCHES: Record<Unit, number> = {
  in: 1,
  ft: INCHES_PER_FOOT,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  m: 100 / 2.54,
};

export class DimensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DimensionError';
  }
}

/** Parse a plain fraction such as "1/2" -> 0.5. Returns null when not a fraction. */
export function parseFraction(text: string): number | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  if (!m) return null;
  const den = Number(m[2]);
  if (!den) return null;
  return Number(m[1]) / den;
}

/** Split "36 1/2" / "36-1/2" / "36.5" style values into whole + fraction. */
function parseWholeAndFraction(text: string): { whole: number; frac: number } | null {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  // feet-inches form is handled separately; here plain inches forms only.
  const m = /^(\d+(?:\.\d+)?)?(?:\s*[-+]\s*|\s+)?(\d+\s*\/\s*\d+)?$/.exec(cleaned);
  if (!m) return null;
  const whole = m[1] ? Number(m[1]) : 0;
  const frac = m[2] ? parseFraction(m[2]) ?? 0 : 0;
  if (Number.isNaN(whole) || Number.isNaN(frac)) return null;
  return { whole, frac };
}

/**
 * Parse a human lumber dimension into inches.
 *
 * Accepted forms:
 *   "96", "96in", "96 in", "96\""
 *   "36-1/2", "36 1/2", "36.5"
 *   "8'", "8' 6\"", "8ft", "8 ft 6 in", "8'6"
 *   "2440mm", "244 cm", "2.44m"
 *   "1/2" (plain fraction)
 *
 * @throws DimensionError when the value cannot be interpreted.
 */
export function parseDimension(input: string | number): { inches: number; unit: Unit } {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new DimensionError(`Invalid dimension: ${input}`);
    return { inches: input, unit: 'in' };
  }

  let text = input.trim();
  if (text === '') throw new DimensionError('Empty dimension');

  // European comma decimal: "6,5" -> 6.5 (also covers "2,5m" style metrics below)
  if (/^\d+(?:\.\d+)?,\d+/.test(text)) text = text.replace(',', '.');

  // Metric: 2440mm / 244 cm / 2.44m
  let m = /^([+-]?\d+(?:\.\d+)?)\s*(mm|cm|m)$/i.exec(text);
  if (m) {
    const unit = m[2].toLowerCase() as Unit;
    const inches = Number(m[1]) * UNIT_FACTOR_TO_INCHES[unit];
    if (!Number.isFinite(inches)) throw new DimensionError(`Invalid dimension: ${input}`);
    return { inches, unit };
  }

  // Plain fraction: "1/2" -> 0.5
  if (/^[+-]?\d+\s*\/\s*\d+$/.test(text)) {
    const sign = text.trim().startsWith('-') ? -1 : 1;
    const frac = parseFraction(text.replace(/^[+-]/, ''));
    if (frac === null) throw new DimensionError(`Invalid dimension: ${input}`);
    const inches = sign * frac;
    if (!Number.isFinite(inches)) throw new DimensionError(`Invalid dimension: ${input}`);
    return { inches, unit: 'in' };
  }

  // Feet + inches: 8' / 8' 6" / 8ft / 8ft 6in / 8'6 / 8 ft 6
  m = /^([+-]?\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:(\d+(?:\.\d+)?(?:\s*[-+]\s*|\s+)?(?:\d+\s*\/\s*\d+)?)\s*(?:"|in)?)?$/i.exec(text);
  if (m) {
    const feet = Number(m[1]);
    const extra = m[2];
    let fracInches = 0;
    if (extra) {
      const parsed = parseWholeAndFraction(extra);
      if (!parsed) throw new DimensionError(`Invalid dimension: ${input}`);
      fracInches = parsed.whole + parsed.frac;
    }
    const inches = feet * INCHES_PER_FOOT + fracInches;
    if (!Number.isFinite(inches)) throw new DimensionError(`Invalid dimension: ${input}`);
    return { inches, unit: 'ft' };
  }

  // Inches with explicit suffix: 96in / 96 in / 96"
  m = /^([+-]?\d+(?:\.\d+)?(?:\s*[-+]\s*|\s+)?(?:\d+\s*\/\s*\d+)?)\s*(?:"|in|inches)?$/i.exec(text);
  if (m && m[1]) {
    const parsed = parseWholeAndFraction(m[1]);
    if (!parsed) throw new DimensionError(`Invalid dimension: ${input}`);
    const inches = parsed.whole + parsed.frac;
    if (!Number.isFinite(inches)) throw new DimensionError(`Invalid dimension: ${input}`);
    return { inches, unit: 'in' };
  }

  throw new DimensionError(
    `Cannot parse dimension "${input}". Use inches (36-1/2), feet (8' 6"), metric (2440mm), or decimals (36.5).`,
  );
}

/** Convert any supported length value into inches. */
export function toInches(value: number, unit: Unit): number {
  if (!Number.isFinite(value)) throw new DimensionError(`Invalid length value: ${value}`);
  return value * UNIT_FACTOR_TO_INCHES[unit];
}

/** Convert inches into the requested unit. */
export function fromInches(inches: number, unit: Unit): number {
  if (!Number.isFinite(inches)) throw new DimensionError(`Invalid inches value: ${inches}`);
  return inches / UNIT_FACTOR_TO_INCHES[unit];
}

export function inchesToFeet(inches: number): number {
  return inches / INCHES_PER_FOOT;
}

/** Reduce a decimal to the nearest fraction with the given max denominator. */
export function toFraction(decimal: number, maxDenominator = 16): { whole: number; num: number; den: number } | null {
  if (!Number.isFinite(decimal)) return null;
  const sign = decimal < 0 ? -1 : 1;
  let value = Math.abs(decimal);
  const whole = Math.floor(value);
  value -= whole;
  if (value < 1e-9) return { whole: sign * whole, num: 0, den: 1 };
  let bestNum = 0;
  let bestDen = 1;
  let bestErr = Number.POSITIVE_INFINITY;
  for (let den = 1; den <= maxDenominator; den++) {
    const num = Math.round(value * den);
    if (num > den) continue;
    const err = Math.abs(value - num / den);
    if (err < bestErr) {
      bestErr = err;
      bestNum = num;
      bestDen = den;
      if (err < 1e-9) break;
    }
  }
  if (bestNum === 0) return { whole: sign * whole, num: 0, den: 1 };
  return { whole: sign * whole, num: bestNum, den: bestDen };
}

export interface FormatInchesOptions {
  /** Round fractional part to this denominator (1 disables fractions). */
  maxDenominator?: number;
  /** Render as feet + inches (e.g. "8'-6\""). */
  asFeet?: boolean;
}

/** Format inches the way a lumberyard writes it: "36-1/2", "8'-6\"". */
export function formatInches(inches: number, opts: FormatInchesOptions = {}): string {
  const { maxDenominator = 16, asFeet = false } = opts;
  if (!Number.isFinite(inches)) return String(inches);
  const frac = toFraction(inches, maxDenominator);
  if (!frac) return String(inches);

  if (asFeet) {
    const totalInches = frac.whole + frac.num / frac.den;
    const feet = Math.floor(totalInches / INCHES_PER_FOOT);
    const rem = totalInches - feet * INCHES_PER_FOOT;
    const remLabel = formatInches(rem, { maxDenominator });
    let out = `${feet}'`;
    if (remLabel !== '0') out += `-${remLabel}"`;
    return out;
  }

  if (frac.num === 0) return String(frac.whole);
  const wholePart = frac.whole === 0 ? '' : String(frac.whole);
  return `${wholePart}${frac.whole === 0 ? '' : '-'}${frac.num}/${frac.den}`;
}

/** 4/4 = 1", 6/4 = 1.5", 8/4 = 2", 12/4 = 3" ... */
export function inchesFromQuarter(quarter: number): number {
  if (!Number.isFinite(quarter) || quarter <= 0) throw new DimensionError(`Invalid quarter thickness: ${quarter}`);
  return quarter / 4;
}

/** Parse "8/4", "6/4", 2 (plain inches), or "2in" into the nominal thickness in inches. */
export function parseThickness(input: string | number): { thicknessIn: number; quarter: number | null } {
  if (typeof input === 'number') return { thicknessIn: input, quarter: input * 4 };
  const text = String(input).trim();
  const m = /^(\d+)\s*\/\s*4$/.exec(text);
  if (m) {
    const quarter = Number(m[1]);
    return { thicknessIn: quarter / 4, quarter };
  }
  const inches = parseDimension(text).inches;
  return { thicknessIn: inches, quarter: Math.round(inches * 4) };
}

/** Format a thickness in inches as quarter thickness when it lands on a quarter. */
export function formatQuarterThickness(thicknessIn: number): string | null {
  const quarter = thicknessIn * 4;
  if (Math.abs(quarter - Math.round(quarter)) < 1e-6) {
    return `${Math.round(quarter)}/4`;
  }
  return null;
}

/**
 * Map a measured thickness to the nominal quarter used for billing.
 * Hardwood is billed at the quarter it was sawn: a 13/16" or 3/4" surfaced
 * 4/4 board bills as 4/4 (1"), while an exact 1" or 1.5" stays put.
 * Result: round up to the next 1/4", minimum 1" (4/4).
 */
export function nominalThicknessFromActual(thicknessIn: number): number {
  if (!Number.isFinite(thicknessIn) || thicknessIn <= 0) throw new DimensionError(`Invalid thickness: ${thicknessIn}`);
  return Math.max(1, Math.ceil(thicknessIn * 4 - 1e-9) / 4);
}

export function roundTo(value: number, precision: number): number {
  const factor = 1 / precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
