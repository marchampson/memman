export type MemoryCategory =
  | 'coding_standard'
  | 'architecture'
  | 'command'
  | 'convention'
  | 'debugging'
  | 'preference'
  | 'workflow'
  | 'dependency'
  | 'security'
  | 'testing'
  | 'correction';

export type ScopeLevel = 'global' | 'project' | 'directory';

export type SourceType = 'claude_md' | 'agents_md' | 'claude_rule' | 'auto_memory' | 'manual' | 'correction_capture';

export interface MemoryScope {
  level: ScopeLevel;
  project?: string;
  directory?: string;
}

export interface MemorySource {
  type: SourceType;
  file_path: string;
}

export interface SyncTarget {
  type: SourceType;
  file_path: string;
  hash_at_sync: string;
}

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  scope: MemoryScope;
  paths?: string[];
  source: MemorySource;
  targets: SyncTarget[];
  created_at: string;
  updated_at: string;
  use_count: number;
  staleness_score: number;
  supersedes?: string;
  tags: string[];
  content_hash: string;
}

export interface Correction {
  id: string;
  incorrect: string;
  correct: string;
  category: MemoryCategory;
  paths?: string[];
  confidence: number;
  source: 'mcp' | 'hook_pattern' | 'hook_llm' | 'manual';
  session_id?: string;
  created_at: string;
  memory_entry_id?: string;
}

export interface SyncState {
  id: string;
  source_file: string;
  target_file: string;
  source_hash: string;
  target_hash: string;
  last_synced_at: string;
  direction: SyncDirection;
}

export type SyncDirection = 'bidirectional' | 'claude-to-agents' | 'agents-to-claude';

export interface ParsedSection {
  id?: string;
  heading?: string;
  level: number;
  content: string;
  entries: ParsedEntry[];
  managed: boolean;
  managedId?: string;
}

export interface ParsedEntry {
  content: string;
  heading?: string;
  level: number;
  tags: string[];
  paths?: string[];
}

export interface ParsedDocument {
  sections: ParsedSection[];
  raw: string;
  filePath: string;
  type: SourceType;
}

export interface SyncResult {
  entriesAdded: number;
  entriesUpdated: number;
  entriesRemoved: number;
  conflicts: SyncConflict[];
  dryRun: boolean;
}

export interface SyncConflict {
  entryId: string;
  sourceContent: string;
  targetContent: string;
  resolution?: 'source' | 'target' | 'manual';
}

export interface OptimizeResult {
  originalTokens: number;
  optimizedTokens: number;
  rulesCreated: number;
  alwaysLoadedEntries: number;
  pathScopedEntries: number;
  files: { path: string; tokenCount: number; }[];
}

export interface StalenessResult {
  entry: MemoryEntry;
  score: number;
  factors: {
    age: number;
    usage: number;
    contradiction: number;
  };
  recommendation: 'fresh' | 'review' | 'demote' | 'delete';
}

export interface AuditResult {
  totalEntries: number;
  staleEntries: StalenessResult[];
  syncDrift: { file: string; drifted: boolean; }[];
  coverage: { categories: Record<MemoryCategory, number>; };
  tokenBudget: { used: number; limit: number; };
  issues: AuditIssue[];
}

export interface AuditIssue {
  severity: 'info' | 'warning' | 'error';
  message: string;
  file?: string;
  entryId?: string;
}

export interface MemmanConfig {
  dbPath: string;
  projectRoot: string;
  claudeMdPath?: string;
  agentsMdPath?: string;
  rulesDir?: string;
  autoMemoryDir?: string;
  tokenBudget: number;
  syncDirection: SyncDirection;
  llm: {
    enabled: boolean;
    apiKey?: string;
    model: string;
  };
}

export const DEFAULT_CONFIG: Partial<MemmanConfig> = {
  tokenBudget: 32768,
  syncDirection: 'bidirectional',
  llm: {
    enabled: false,
    model: 'claude-haiku-4-5-20251001',
  },
};
