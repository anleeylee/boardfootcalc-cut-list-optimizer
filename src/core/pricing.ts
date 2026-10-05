/**
 * pricing.ts — Lumber pricing model.
 *
 * Supports the price modes lumber dealers actually quote:
 *   $/BF, $/MBF, $/piece, $/linear foot, and a manual per-line total.
 * Every mode is normalized to an internal cost-per-BF so all five desktop
 * tools share one pricing engine.
 */

export type PriceMode = 'perBF' | 'perMBF' | 'perPiece' | 'perLF' | 'manual';

export const PRICE_MODES: PriceMode[] = ['perBF', 'perMBF', 'perPiece', 'perLF', 'manual'];

export interface PriceContext {
  /** BF of one piece. */
  pieceBF: number;
  /** Length of one piece in inches (needed for $/LF). */
  pieceLengthIn: number;
  /** Number of pieces on the line. */
  quantity: number;
}

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

/**
 * Normalize a quoted price into effective dollars per board foot.
 *
 * perBF   -> value
 * perMBF  -> value / 1000   (a $1,850/MBF quote is $1.85/BF)
 * perPiece-> value / pieceBF
 * perLF   -> value / (length in ft)  -> $/ft ÷ (piece BF per ft of length)
 * manual  -> value is the quoted line total; per-BF = total / line BF
 */
export function pricePerBF(mode: PriceMode, value: number, ctx: PriceContext): number {
  if (!Number.isFinite(value) || value < 0) throw new PricingError(`Invalid price: ${value}`);
  switch (mode) {
    case 'perBF':
      return value;
    case 'perMBF':
      return value / 1000;
    case 'perPiece': {
      if (ctx.pieceBF <= 0) throw new PricingError('Piece pricing requires a positive board foot value.');
      return value / ctx.pieceBF;
    }
    case 'perLF': {
      const lengthFt = ctx.pieceLengthIn / 12;
      if (lengthFt <= 0) throw new PricingError('Linear-foot pricing requires a positive piece length.');
      const bfPerFt = ctx.pieceBF / lengthFt;
      if (bfPerFt <= 0) throw new PricingError('Linear-foot pricing requires a positive board foot value.');
      // $/LF ÷ (BF per linear foot) -> $/BF
      return value / bfPerFt;
    }
    case 'manual': {
      const lineBF = ctx.pieceBF * ctx.quantity;
      if (lineBF <= 0) throw new PricingError('Manual pricing requires a positive board foot quantity.');
      return value / lineBF;
    }
  }
}

/** Extended cost of a line: BF × effective $/BF. */
export function lineCost(bf: number, effectivePricePerBF: number): number {
  return bf * effectivePricePerBF;
}

export interface InvoiceTotalsInput {
  subtotal: number;
  taxRate: number; // 0.07 = 7%
  taxIncluded: boolean; // true when prices already include tax
  delivery: number;
  discount: number; // positive number subtracted
  otherFees: number;
}

export interface InvoiceTotals {
  subtotal: number;
  tax: number;
  delivery: number;
  discount: number;
  otherFees: number;
  total: number;
}

/** Invoice total = subtotal + tax + delivery + other fees − discount.
 * When tax is already included in the subtotal, it is NOT added again —
 * the total equals subtotal + delivery + fees − discount. */
export function invoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  let tax: number;
  let total: number;
  if (input.taxIncluded) {
    tax = input.subtotal * (input.taxRate / (1 + input.taxRate));
    total = input.subtotal + input.delivery + input.otherFees - input.discount;
  } else {
    tax = input.subtotal * input.taxRate;
    total = input.subtotal + tax + input.delivery + input.otherFees - input.discount;
  }
  return {
    subtotal: input.subtotal,
    tax,
    delivery: input.delivery,
    discount: input.discount,
    otherFees: input.otherFees,
    total,
  };
}

/** Margin = Profit / Revenue. */
export function margin(profit: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return profit / revenue;
}

/** Markup = Profit / Cost. */
export function markup(profit: number, cost: number): number {
  if (cost <= 0) return 0;
  return profit / cost;
}

/** Given a markup rate (e.g. 0.4), return the equivalent margin. */
export function marginFromMarkup(markupRate: number): number {
  return markupRate / (1 + markupRate);
}

/** Given a margin (e.g. 0.3), return the equivalent markup. */
export function markupFromMargin(marginRate: number): number {
  if (marginRate >= 1) throw new PricingError('Margin must be below 100%.');
  return marginRate / (1 - marginRate);
}

/** Profit needed to achieve a target markup on a cost. */
export function profitForMarkup(cost: number, markupRate: number): number {
  return cost * markupRate;
}

export function formatMoney(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(value);
}
