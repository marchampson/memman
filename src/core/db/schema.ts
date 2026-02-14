import type Database from 'better-sqlite3';

export const SCHEMA_VERSION = 1;

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      scope_level TEXT NOT NULL DEFAULT 'project',
      scope_project TEXT,
      scope_directory TEXT,
      paths TEXT,
      source_type TEXT NOT NULL,
      source_file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      use_count INTEGER NOT NULL DEFAULT 0,
      staleness_score REAL NOT NULL DEFAULT 0.0,
      supersedes TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      content_hash TEXT NOT NULL,
      FOREIGN KEY (supersedes) REFERENCES memory_entries(id)
    );

    CREATE TABLE IF NOT EXISTS sync_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_file_path TEXT NOT NULL,
      hash_at_sync TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      target_file TEXT NOT NULL,
      source_hash TEXT NOT NULL,
      target_hash TEXT NOT NULL,
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
      direction TEXT NOT NULL DEFAULT 'bidirectional'
    );

    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      incorrect TEXT NOT NULL,
      correct TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'correction',
      paths TEXT,
      confidence REAL NOT NULL DEFAULT 0.5,
      source TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      memory_entry_id TEXT,
      FOREIGN KEY (memory_entry_id) REFERENCES memory_entries(id)
    );

    CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      context TEXT,
      FOREIGN KEY (entry_id) REFERENCES memory_entries(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_entries_category ON memory_entries(category);
    CREATE INDEX IF NOT EXISTS idx_entries_content_hash ON memory_entries(content_hash);
    CREATE INDEX IF NOT EXISTS idx_entries_scope ON memory_entries(scope_level, scope_project);
    CREATE INDEX IF NOT EXISTS idx_entries_staleness ON memory_entries(staleness_score);
    CREATE INDEX IF NOT EXISTS idx_sync_targets_entry ON sync_targets(entry_id);
    CREATE INDEX IF NOT EXISTS idx_corrections_source ON corrections(source);
    CREATE INDEX IF NOT EXISTS idx_usage_entry ON usage_log(entry_id);
    CREATE INDEX IF NOT EXISTS idx_usage_accessed ON usage_log(accessed_at);
  `);

  const version = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null } | undefined;
  if (!version || version.v === null) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  }
}
