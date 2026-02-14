export { sync, getSyncDrift, MANAGED_ID } from './engine.js';
export type { SyncOptions } from './engine.js';
export { diffSections, diffEntries } from './differ.js';
export type { DiffResult, ModifiedEntry } from './differ.js';
export { translateEntryToAgents, translateEntryToClaude, shouldSync, categorizeForSync } from './translator.js';
export { writeManagedSection, removeManagedSectionFromFile, writeFullFile } from './writer.js';
