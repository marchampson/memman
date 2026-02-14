// Core types
export * from './types.js';

// Database
export { MemoryRepository } from './db/repository.js';

// Parsers
export {
  parseClaudeMd, serializeClaudeMd, injectClaudeSection, removeManagedSection,
  parseAgentsMd, serializeAgentsMd, injectAgentsSection,
  parseRulesDir, parseRuleFile, generateRuleFile, ruleFileToDocument,
} from './parser/index.js';

// Sync
export {
  sync, getSyncDrift, MANAGED_ID,
  diffSections, diffEntries,
  translateEntryToAgents, translateEntryToClaude, shouldSync, categorizeForSync,
  writeManagedSection, removeManagedSectionFromFile, writeFullFile,
} from './sync/index.js';
export type { SyncOptions, DiffResult, ModifiedEntry } from './sync/index.js';

// Corrections
export {
  detectCorrections, detectCorrectionInEdit,
  extractCorrectionsWithLLM,
  classifyCorrection, mergeCorrections, detectFlipFlop,
  processTranscript, processEdit, captureCorrection,
} from './correction/index.js';
export type { CorrectionCandidate, ExtractedCorrection, ExtractionResult, ClassifiedCorrection, PipelineOptions } from './correction/index.js';

// Optimizer
export {
  analyzeEntries, estimateTokens,
  planSplit, executeSplit,
  analyzeProjectStructure, suggestRulePaths,
} from './optimizer/index.js';
export type { EntryClassification, AnalyzedEntry, SplitPlan, RulePlan, TopicPlan, ProjectStructure } from './optimizer/index.js';

// Staleness
export { scoreEntry, scoreAllEntries, getStaleEntries, checkFilesExist, getLastModified, getRecentlyModifiedFiles } from './staleness/index.js';

// Config
export { resolveConfig, saveConfig, getConfigDir, getDbPath, ensureConfigDir } from './config.js';

// Hash
export { contentHash, fileHash } from './hash.js';
