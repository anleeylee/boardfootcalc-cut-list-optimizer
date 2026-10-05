#!/usr/bin/env node
/**
 * cli.ts — bfc-optimize: Cut List → Lumber Purchase Optimizer CLI.
 *
 * Workflow:  init → import-cutlist → import-boards → run → export-purchase
 * Try it instantly with:  bfc-optimize demo
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemFromCutList, STRATEGIES, optimize } from './features/optimize';
import type { OptimizeStrategy } from './features/optimize/types';
import { exportCutListFile, importCutListFile } from './features/cutlist';
import { exportBoardsFile, importBoardsFile } from './features/boards';
import { emptyProjectFile, loadProjectFile, makeProject, saveProjectFile } from './features/project';
import { exportCuttingPlan, exportPurchaseCSV, purchaseListRows } from './export/purchase';
import { writeTableFile } from './features/io';
import { printResult } from './features/optimize/explain';

const program = new Command();

program
  .name('bfc-optimize')
  .description('Turn a cut list into an optimized, lowest-waste lumber purchase plan.')
  .version('1.0.0');

program
  .command('init')
  .description('Create a new .lumberproject file')
  .option('-n, --name <name>', 'project name', 'Untitled Project')
  .option('-c, --customer <customer>', 'customer name', '')
  .option('-f, --file <file>', 'project file path (default ./project.lumberproject)', './project.lumberproject')
  .action((opts: { name: string; customer: string; file: string }) => {
    const file = emptyProjectFile(makeProject({ name: opts.name, customer: opts.customer }));
    saveProjectFile(opts.file, file);
    console.log(`Created project "${opts.name}" at ${opts.file}`);
  });

program
  .command('import-cutlist')
  .description('Import a cut list from CSV or XLSX')
  .argument('<file>', 'cut list file (.csv/.xlsx)')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((input: string, opts: { file: string }) => {
    const project = loadProjectFile(opts.file);
    const res = importCutListFile(input);
    for (const w of res.warnings) console.warn(`Warning: ${w}`);
    project.cutList = res.items;
    saveProjectFile(opts.file, project);
    console.log(
      `Imported ${res.items.length} cut-list lines (skipped ${res.skipped.length}). ` +
        `Required net BF: ${(res.items.reduce((s, i) => s + (i.thicknessIn * i.widthIn * i.lengthIn) / 144 * i.quantity, 0)).toFixed(2)}`,
    );
    for (const s of res.skipped) console.warn(`  Skipped row ${s.row}: ${s.reason}`);
  });

program
  .command('import-boards')
  .description('Import available boards (existing inventory or supplier stock) from CSV/XLSX')
  .argument('<file>', 'boards file (.csv/.xlsx)')
  .option('--source <source>', 'inventory or supplier', 'supplier')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((input: string, opts: { source: string; file: string }) => {
    const source = opts.source === 'inventory' ? 'inventory' : 'supplier';
    const project = loadProjectFile(opts.file);
    const res = importBoardsFile(input, source);
    for (const w of res.warnings) console.warn(`Warning: ${w}`);
    const kept = project.boards.filter((b) => b.source !== source);
    project.boards = [...kept, ...res.boards];
    saveProjectFile(opts.file, project);
    console.log(`Imported ${res.boards.length} boards as ${source} (skipped ${res.skipped.length}).`);
    for (const s of res.skipped) console.warn(`  Skipped row ${s.row}: ${s.reason}`);
  });

program
  .command('list-cutlist')
  .description('Print the current cut list')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((opts: { file: string }) => {
    const project = loadProjectFile(opts.file);
    if (project.cutList.length === 0) {
      console.log('Cut list is empty.');
      return;
    }
    console.table(
      project.cutList.map((i) => ({
        id: i.partId,
        name: i.partName,
        qty: i.quantity,
        species: i.species,
        t: i.thicknessIn,
        w: i.widthIn,
        l: i.lengthIn,
      })),
    );
  });

program
  .command('list-boards')
  .description('Print available boards')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((opts: { file: string }) => {
    const project = loadProjectFile(opts.file);
    if (project.boards.length === 0) {
      console.log('No boards available. Import supplier stock with import-boards.');
      return;
    }
    console.table(
      project.boards.map((b) => ({
        id: b.boardId,
        species: b.species,
        t: b.thicknessIn,
        w: b.widthIn,
        l: b.lengthIn,
        bf: (b.bf ?? 0).toFixed(2),
        cost: b.totalCost?.toFixed(2) ?? '0.00',
        source: b.source,
        status: b.status,
      })),
    );
  });

program
  .command('run')
  .description('Run the purchase optimization')
  .option('-s, --strategy <strategy>', `optimization strategy: ${STRATEGIES.join(' | ')}`, 'balanced')
  .option('--waste <factor>', 'waste factor for reference (0.30 = 30%)', '0.30')
  .option('--kerf <inches>', 'saw kerf in inches', '0.125')
  .option('-j, --json <file>', 'write full result as JSON')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((opts: { strategy: string; waste: string; kerf: string; json?: string; file: string }) => {
    const project = loadProjectFile(opts.file);
    if (project.cutList.length === 0) {
      console.error('Cut list is empty — import one first (bfc-optimize import-cutlist <file>).');
      process.exit(1);
    }
    if (project.boards.length === 0) {
      console.error('No boards available — import supplier stock first (bfc-optimize import-boards <file>).');
      process.exit(1);
    }
    const strategy = STRATEGIES.includes(opts.strategy as OptimizeStrategy)
      ? (opts.strategy as OptimizeStrategy)
      : 'balanced';
    const kerf = Number(opts.kerf);
    const waste = Number(opts.waste);
    if (!Number.isFinite(kerf) || kerf < 0) {
      console.error('Invalid kerf (must be >= 0 inches).');
      process.exit(1);
    }

    console.log(`Project: ${project.project.name} | strategy: ${strategy} | kerf: ${kerf}" | waste ref: ${Math.round(waste * 100)}%`);
    const result = optimize(
      project.cutList.map(itemFromCutList),
      project.boards,
      strategy,
      { kerf, wasteFactor: waste, toleranceIn: 0.001 },
    );
    printResult(result);
    if (opts.json) {
      writeFileSync(opts.json, JSON.stringify(result, null, 2), 'utf8');
      console.log(`\nFull result written to ${opts.json}`);
    }
  });

program
  .command('export-purchase')
  .description('Export the last purchase plan as CSV/XLSX/JSON + cutting plan')
  .option('--csv <file>', 'purchase list CSV/XLSX output path')
  .option('--cutting-plan <file>', 'cutting plan JSON output path')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((opts: { csv?: string; cuttingPlan?: string; file: string }) => {
    const project = loadProjectFile(opts.file);
    if (project.cutList.length === 0 || project.boards.length === 0) {
      console.error('Nothing to export — import a cut list and boards first.');
      process.exit(1);
    }
    const result = optimize(
      project.cutList.map(itemFromCutList),
      project.boards,
      'balanced',
      { kerf: project.settings.kerf, wasteFactor: project.settings.wasteFactor, toleranceIn: 0.001 },
    );
    if (opts.csv) {
      exportPurchaseCSV(opts.csv, result);
      console.log(`Purchase list written to ${opts.csv}`);
    }
    if (opts.cuttingPlan) {
      exportCuttingPlan(opts.cuttingPlan, result);
      console.log(`Cutting plan written to ${opts.cuttingPlan}`);
    }
    if (!opts.csv && !opts.cuttingPlan) {
      console.error('Provide --csv and/or --cutting-plan output paths.');
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Dashboard summary of required vs available vs purchase')
  .option('-f, --file <file>', 'project file path', './project.lumberproject')
  .action((opts: { file: string }) => {
    const project = loadProjectFile(opts.file);
    const requiredBF = project.cutList.reduce((s, i) => s + (i.thicknessIn * i.widthIn * i.lengthIn) / 144 * i.quantity, 0);
    const availableBF = project.boards.filter((b) => b.source === 'inventory' && b.status.toUpperCase() === 'AVAILABLE').reduce((s, b) => s + b.bf, 0);
    const supplierBF = project.boards.filter((b) => b.source === 'supplier').reduce((s, b) => s + b.bf, 0);
    console.log('=== Dashboard ===');
    console.log(`  Required BF (cut list): ${requiredBF.toFixed(2)}`);
    console.log(`  Available BF (inventory): ${availableBF.toFixed(2)}`);
    console.log(`  Supplier BF (available to buy): ${supplierBF.toFixed(2)}`);
    console.log(`  Cut list lines: ${project.cutList.length}`);
    console.log(`  Boards on file: ${project.boards.length}`);
    console.log('  Run "bfc-optimize run" for the purchase plan.');
  });

program
  .command('demo')
  .description('Create sample data in ./demo and run a full optimization')
  .action(() => {
    const dir = join(process.cwd(), 'demo');
    mkdirSync(dir, { recursive: true });
    const projectPath = join(dir, 'demo.lumberproject');

    const project = emptyProjectFile(
      makeProject({ name: 'Demo Sideboard', customer: 'Sample Customer', defaultWasteFactor: 0.3, defaultKerf: 0.125 }),
    );
    saveProjectFile(projectPath, project);

    const cutlistPath = join(dir, 'cutlist.csv');
    writeTableFile(cutlistPath, [
      ['Part ID', 'Part Name', 'Quantity', 'Species', 'Grade', 'Thickness', 'Width', 'Length', 'Grain Direction', 'Rotation Allowed'],
      ['T1', 'Top', 1, 'Black Walnut', 'FAS', '8/4', 24, 48, 'vertical', 'no'],
      ['S1', 'Side', 2, 'Black Walnut', 'FAS', '8/4', 18, 30, 'vertical', 'no'],
      ['S2', 'Inner Side', 2, 'Black Walnut', 'FAS', '8/4', 16, 28, 'vertical', 'no'],
      ['F1', 'Front Rail', 2, 'Black Walnut', 'FAS', '4/4', 3, 46, 'vertical', 'no'],
      ['F2', 'Front Rail', 2, 'Black Walnut', 'FAS', '4/4', 3, 22, 'vertical', 'no'],
      ['D1', 'Drawer Front', 4, 'Black Walnut', 'FAS', '4/4', 6, 14, 'any', 'yes'],
    ]);
    const inventoryPath = join(dir, 'inventory.csv');
    writeTableFile(inventoryPath, [
      ['Board ID', 'Species', 'Grade', 'Thickness', 'Width', 'Length', 'Cost/BF', 'Fixed Cost', 'Location', 'Status'],
      ['INV-01', 'Black Walnut', 'FAS', '8/4', 10, 72, 0, 0, 'Rack A', 'AVAILABLE'],
      ['INV-02', 'Black Walnut', 'FAS', '4/4', 8, 60, 0, 0, 'Rack A', 'AVAILABLE'],
    ]);
    const supplierPath = join(dir, 'suppliers.csv');
    writeTableFile(supplierPath, [
      ['Board ID', 'Species', 'Grade', 'Thickness', 'Width', 'Length', 'Cost/BF', 'Fixed Cost', 'Location'],
      ['SUP-01', 'Black Walnut', 'FAS', '8/4', 12, 96, 12.5, 0, 'Dealer A'],
      ['SUP-02', 'Black Walnut', 'FAS', '8/4', 10, 96, 12.25, 5, 'Dealer A'],
      ['SUP-03', 'Black Walnut', 'FAS', '4/4', 8, 96, 10.5, 0, 'Dealer B'],
      ['SUP-04', 'Black Walnut', 'FAS', '4/4', 6, 48, 9.8, 0, 'Dealer B'],
    ]);

    const cutRes = importCutListFile(cutlistPath);
    const invRes = importBoardsFile(inventoryPath, 'inventory');
    const supRes = importBoardsFile(supplierPath, 'supplier');

    project.cutList = cutRes.items;
    project.boards = [...invRes.boards, ...supRes.boards];
    saveProjectFile(projectPath, project);

    console.log(`Demo project created: ${projectPath}`);
    console.log(`  Cut list: ${cutRes.items.length} lines | Inventory: ${invRes.boards.length} boards | Supplier: ${supRes.boards.length} boards`);
    for (const s of [...cutRes.skipped, ...invRes.skipped, ...supRes.skipped]) console.warn(`  Skipped: ${s.reason}`);
    console.log('\n=== Optimization (balanced) ===');

    const result = optimize(
      project.cutList.map(itemFromCutList),
      project.boards,
      'balanced',
      { kerf: 0.125, wasteFactor: 0.3, toleranceIn: 0.001 },
    );
    printResult(result);

    const purchasePath = join(dir, 'purchase-list.csv');
    exportPurchaseCSV(purchasePath, result);
    const planPath = join(dir, 'cutting-plan.json');
    exportCuttingPlan(planPath, result);
    exportBoardsFile(join(dir, 'boards-export.csv'), project.boards);
    exportCutListFile(join(dir, 'cutlist-export.csv'), project.cutList);
    console.log(`\nExports written to ${dir}/`);
  });

program.parseAsync(process.argv).catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});

// Keep the exports import used (handy for embedding as a library).
export { optimize, purchaseListRows };
