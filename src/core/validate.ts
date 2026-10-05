/**
 * validate.ts — Zod schemas shared across the five desktop tools.
 * Every schema validates the *normalized* numeric model (dimensions already
 * converted to inches) and produces human-readable error messages.
 */

import { z } from 'zod';

export const nonNegativeNumber = z.number().finite();
export const positiveNumber = z.number().positive().finite();

export const cutListItemSchema = z.object({
  partId: z.string().min(1, 'Part ID is required'),
  partName: z.string().optional().default(''),
  quantity: positiveNumber,
  species: z.string().min(1, 'Species is required'),
  grade: z.string().optional().default(''),
  thicknessIn: positiveNumber,
  widthIn: positiveNumber,
  lengthIn: positiveNumber,
  grainDirection: z.enum(['vertical', 'horizontal', 'any']).optional().default('any'),
  rotationAllowed: z.boolean().optional().default(true),
  edgeRequirement: z.enum(['none', 'one-clean', 'two-clean']).optional().default('none'),
  notes: z.string().optional().default(''),
});
export type CutListItem = z.infer<typeof cutListItemSchema>;

export const stockBoardSchema = z.object({
  boardId: z.string().min(1, 'Board ID is required'),
  species: z.string().min(1, 'Species is required'),
  grade: z.string().optional().default(''),
  thicknessIn: positiveNumber,
  widthIn: positiveNumber,
  lengthIn: positiveNumber,
  costPerBF: nonNegativeNumber.optional().default(0),
  fixedCost: nonNegativeNumber.optional().default(0),
  location: z.string().optional().default(''),
  grainDirection: z.enum(['vertical', 'horizontal', 'any']).optional().default('any'),
  defects: z.array(z.object({ x: nonNegativeNumber, y: nonNegativeNumber, width: nonNegativeNumber, length: nonNegativeNumber })).optional().default([]),
  status: z.string().optional().default('AVAILABLE'),
  source: z.enum(['inventory', 'supplier']).optional().default('supplier'),
});
export type StockBoard = z.infer<typeof stockBoardSchema>;

export const tallyRecordSchema = z.object({
  lineId: z.string().optional().default(''),
  boardId: z.string().optional().default(''),
  species: z.string().optional().default(''),
  grade: z.string().optional().default(''),
  thicknessIn: positiveNumber.optional(),
  widthIn: positiveNumber.optional(),
  lengthIn: positiveNumber.optional(),
  quantity: positiveNumber.optional().default(1),
  dealerBF: nonNegativeNumber.optional(),
  pricePerBF: nonNegativeNumber.optional().default(0),
  priceMode: z.enum(['perBF', 'perMBF', 'perPiece', 'perLF', 'manual']).optional().default('perBF'),
  extendedCost: nonNegativeNumber.optional(),
  notes: z.string().optional().default(''),
});
export type TallyRecord = z.infer<typeof tallyRecordSchema>;

export const inventoryItemSchema = z.object({
  inventoryId: z.string().min(1, 'Inventory ID is required'),
  species: z.string().min(1, 'Species is required'),
  scientificName: z.string().optional().default(''),
  grade: z.string().optional().default(''),
  thicknessIn: positiveNumber,
  widthIn: positiveNumber,
  lengthIn: positiveNumber,
  quantity: positiveNumber,
  costPerBF: nonNegativeNumber.optional().default(0),
  totalCost: nonNegativeNumber.optional(),
  supplier: z.string().optional().default(''),
  purchaseDate: z.string().optional().default(''),
  location: z.string().optional().default(''),
  moistureContent: z.number().min(0).max(100).optional().default(12),
  grainDirection: z.enum(['vertical', 'horizontal', 'any']).optional().default('any'),
  status: z.enum(['AVAILABLE', 'RESERVED', 'ALLOCATED', 'CUT', 'SCRAP', 'SOLD']).optional().default('AVAILABLE'),
  notes: z.string().optional().default(''),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const projectSchema = z.object({
  projectId: z.string().optional().default(''),
  name: z.string().min(1, 'Project name is required'),
  customer: z.string().optional().default(''),
  contact: z.string().optional().default(''),
  estimator: z.string().optional().default(''),
  createdDate: z.string().optional().default(''),
  validUntil: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  unitSystem: z.enum(['imperial', 'metric']).optional().default('imperial'),
  currency: z.string().optional().default('USD'),
  defaultWasteFactor: nonNegativeNumber.optional().default(0.3),
  defaultKerf: nonNegativeNumber.optional().default(0.125),
  taxRate: nonNegativeNumber.optional().default(0),
  deliveryCost: nonNegativeNumber.optional().default(0),
});
export type Project = z.infer<typeof projectSchema>;

export const quoteLineSchema = z.object({
  lineId: z.string().optional().default(''),
  species: z.string().min(1, 'Species is required'),
  grade: z.string().optional().default(''),
  thicknessIn: positiveNumber,
  widthIn: positiveNumber,
  lengthIn: positiveNumber,
  quantity: positiveNumber,
  requiredBF: nonNegativeNumber.optional(),
  wasteFactor: nonNegativeNumber.optional().default(0.3),
  priceMode: z.enum(['perBF', 'perMBF', 'perPiece', 'perLF', 'manual']).optional().default('perBF'),
  price: nonNegativeNumber.optional(),
  priceDate: z.string().optional().default(''),
  supplier: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

/** Render a Zod error as a short, friendly message. */
export function friendlyZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path.join('.') || 'value';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
