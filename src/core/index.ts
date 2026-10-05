/**
 * index.ts — Shared Lumber Calculation Engine
 *
 * One implementation of lumber math shared by all five BoardFootCalc desktop
 * tools. Edit the engine here (shared-engine/), then run
 * `npm run sync:engine` at the repository root to copy it into each tool's
 * `src/core/` folder before publishing.
 */

export * from './units';
export * from './boardfoot';
export * from './species';
export * from './pricing';
export * from './csv';
export * from './validate';

export const ENGINE_VERSION = '1.0.0';

export const ENGINE_DISCLAIMER =
  'Board foot and weight values are estimates for planning purposes. ' +
  'Verify every dimension, price and rounding rule against your lumber yard before purchasing.';
