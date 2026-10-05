/**
 * project.ts — Project model + the .lumberproject JSON container file.
 *
 * A project file bundles everything needed to plan a purchase:
 *   project meta, cut list, available boards, optimization settings.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Project, projectSchema } from '../core';
import type { CutListItem } from '../core';
import type { BoardInput } from './optimize/types';

export interface OptimizationSettings {
  wasteFactor: number;
  kerf: number;
  trimAllowance: number;
}

export interface LumberProjectFile {
  format: 'boardfootcalc-lumberproject';
  version: number;
  project: Project;
  settings: OptimizationSettings;
  cutList: CutListItem[];
  boards: BoardInput[];
}

export const DEFAULT_SETTINGS: OptimizationSettings = { wasteFactor: 0.3, kerf: 0.125, trimAllowance: 0 };

export function emptyProjectFile(project: Project): LumberProjectFile {
  return {
    format: 'boardfootcalc-lumberproject',
    version: 1,
    project,
    settings: { ...DEFAULT_SETTINGS, wasteFactor: project.defaultWasteFactor ?? 0.3, kerf: project.defaultKerf ?? 0.125 },
    cutList: [],
    boards: [],
  };
}

export function loadProjectFile(path: string): LumberProjectFile {
  if (!existsSync(path)) throw new Error(`Project file not found: ${path}`);
  const raw = JSON.parse(readFileSync(path, 'utf8')) as LumberProjectFile;
  if (raw.format !== 'boardfootcalc-lumberproject') {
    throw new Error(`Not a .lumberproject file: ${path}`);
  }
  return raw;
}

export function saveProjectFile(path: string, file: LumberProjectFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(file, null, 2), 'utf8');
}

export function defaultProjectFile(projectPath: string): string {
  // If the user passes a .lumberproject path use it; otherwise create one
  // next to the input or in the working directory.
  return projectPath.endsWith('.lumberproject') ? projectPath : join(process.cwd(), 'project.lumberproject');
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  const today = new Date().toISOString().slice(0, 10);
  const parsed = projectSchema.parse({
    projectId: `PRJ-${Date.now().toString(36).toUpperCase()}`,
    name: 'Untitled Project',
    createdDate: today,
    unitSystem: 'imperial',
    currency: 'USD',
    defaultWasteFactor: 0.3,
    defaultKerf: 0.125,
    ...overrides,
  });
  return parsed;
}
