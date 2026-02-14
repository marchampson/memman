import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { initializeSchema } from './schema.js';
import type {
  MemoryEntry,
  MemoryCategory,
  Correction,
  SyncState,
  SyncTarget,
  MemoryScope,
  MemorySource,
} from '../types.js';

export class MemoryRepository {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    initializeSchema(this.db);
  }

  close(): void {
    this.db.close();
  }

  // --- Memory Entries ---

  createEntry(entry: Omit<MemoryEntry, 'id' | 'created_at' | 'updated_at' | 'use_count' | 'staleness_score'>): MemoryEntry {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO memory_entries (id, content, category, scope_level, scope_project, scope_directory, paths, source_type, source_file_path, created_at, updated_at, content_hash, tags, supersedes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.content,
      entry.category,
      entry.scope.level,
      entry.scope.project ?? null,
      entry.scope.directory ?? null,
      entry.paths ? JSON.stringify(entry.paths) : null,
      entry.source.type,
      entry.source.file_path,
      now,
      now,
      entry.content_hash,
      JSON.stringify(entry.tags),
      entry.supersedes ?? null,
    );

    for (const target of entry.targets) {
      this.addSyncTarget(id, target);
    }

    return {
      ...entry,
      id,
      created_at: now,
      updated_at: now,
      use_count: 0,
      staleness_score: 0,
    };
  }

  getEntry(id: string): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memory_entries WHERE id = ?').get(id) as MemoryEntryRow | undefined;
    if (!row) return null;
    const targets = this.getSyncTargets(id);
    return this.rowToEntry(row, targets);
  }

  getEntryByHash(hash: string): MemoryEntry | null {
    const row = this.db.prepare('SELECT * FROM memory_entries WHERE content_hash = ?').get(hash) as MemoryEntryRow | undefined;
    if (!row) return null;
    const targets = this.getSyncTargets(row.id);
    return this.rowToEntry(row, targets);
  }

  getAllEntries(filters?: {
    category?: MemoryCategory;
    scope_level?: string;
    project?: string;
    minStaleness?: number;
    maxStaleness?: number;
  }): MemoryEntry[] {
    let sql = 'SELECT * FROM memory_entries WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters?.scope_level) {
      sql += ' AND scope_level = ?';
      params.push(filters.scope_level);
    }
    if (filters?.project) {
      sql += ' AND scope_project = ?';
      params.push(filters.project);
    }
    if (filters?.minStaleness !== undefined) {
      sql += ' AND staleness_score >= ?';
      params.push(filters.minStaleness);
    }
    if (filters?.maxStaleness !== undefined) {
      sql += ' AND staleness_score <= ?';
      params.push(filters.maxStaleness);
    }

    sql += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as MemoryEntryRow[];
    return rows.map(row => {
      const targets = this.getSyncTargets(row.id);
      return this.rowToEntry(row, targets);
    });
  }

  updateEntry(id: string, updates: Partial<Pick<MemoryEntry, 'content' | 'category' | 'paths' | 'tags' | 'content_hash' | 'staleness_score' | 'supersedes'>>): void {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.content !== undefined) { sets.push('content = ?'); params.push(updates.content); }
    if (updates.category !== undefined) { sets.push('category = ?'); params.push(updates.category); }
    if (updates.paths !== undefined) { sets.push('paths = ?'); params.push(JSON.stringify(updates.paths)); }
    if (updates.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(updates.tags)); }
    if (updates.content_hash !== undefined) { sets.push('content_hash = ?'); params.push(updates.content_hash); }
    if (updates.staleness_score !== undefined) { sets.push('staleness_score = ?'); params.push(updates.staleness_score); }
    if (updates.supersedes !== undefined) { sets.push('supersedes = ?'); params.push(updates.supersedes); }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    params.push(id);

    this.db.prepare(`UPDATE memory_entries SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  deleteEntry(id: string): void {
    this.db.prepare('DELETE FROM memory_entries WHERE id = ?').run(id);
  }

  incrementUseCount(id: string, context?: string): void {
    this.db.prepare('UPDATE memory_entries SET use_count = use_count + 1 WHERE id = ?').run(id);
    this.db.prepare('INSERT INTO usage_log (entry_id, context) VALUES (?, ?)').run(id, context ?? null);
  }

  searchEntries(query: string, limit = 20): MemoryEntry[] {
    const rows = this.db.prepare(`
      SELECT * FROM memory_entries
      WHERE content LIKE ?
      ORDER BY use_count DESC, updated_at DESC
      LIMIT ?
    `).all(`%${query}%`, limit) as MemoryEntryRow[];

    return rows.map(row => {
      const targets = this.getSyncTargets(row.id);
      return this.rowToEntry(row, targets);
    });
  }

  getEntriesByPaths(filePaths: string[]): MemoryEntry[] {
    const entries = this.getAllEntries();
    return entries.filter(entry => {
      if (!entry.paths || entry.paths.length === 0) return false;
      return filePaths.some(fp =>
        entry.paths!.some(pattern => matchGlob(pattern, fp))
      );
    });
  }

  // --- Sync Targets ---

  private addSyncTarget(entryId: string, target: SyncTarget): void {
    this.db.prepare(`
      INSERT INTO sync_targets (entry_id, target_type, target_file_path, hash_at_sync)
      VALUES (?, ?, ?, ?)
    `).run(entryId, target.type, target.file_path, target.hash_at_sync);
  }

  private getSyncTargets(entryId: string): SyncTarget[] {
    const rows = this.db.prepare('SELECT * FROM sync_targets WHERE entry_id = ?').all(entryId) as SyncTargetRow[];
    return rows.map(r => ({
      type: r.target_type as SyncTarget['type'],
      file_path: r.target_file_path,
      hash_at_sync: r.hash_at_sync,
    }));
  }

  updateSyncTarget(entryId: string, targetType: string, targetFile: string, newHash: string): void {
    this.db.prepare(`
      UPDATE sync_targets SET hash_at_sync = ? WHERE entry_id = ? AND target_type = ? AND target_file_path = ?
    `).run(newHash, entryId, targetType, targetFile);
  }

  // --- Sync State ---

  getSyncState(sourceFile: string, targetFile: string): SyncState | null {
    const row = this.db.prepare('SELECT * FROM sync_state WHERE source_file = ? AND target_file = ?')
      .get(sourceFile, targetFile) as SyncStateRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      source_file: row.source_file,
      target_file: row.target_file,
      source_hash: row.source_hash,
      target_hash: row.target_hash,
      last_synced_at: row.last_synced_at,
      direction: row.direction as SyncState['direction'],
    };
  }

  upsertSyncState(state: Omit<SyncState, 'id'>): void {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO sync_state (id, source_file, target_file, source_hash, target_hash, direction)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_hash = excluded.source_hash,
        target_hash = excluded.target_hash,
        last_synced_at = datetime('now')
    `).run(id, state.source_file, state.target_file, state.source_hash, state.target_hash, state.direction);
  }

  updateSyncStateHashes(sourceFile: string, targetFile: string, sourceHash: string, targetHash: string): void {
    this.db.prepare(`
      UPDATE sync_state SET source_hash = ?, target_hash = ?, last_synced_at = datetime('now')
      WHERE source_file = ? AND target_file = ?
    `).run(sourceHash, targetHash, sourceFile, targetFile);
  }

  // --- Corrections ---

  createCorrection(correction: Omit<Correction, 'id' | 'created_at'>): Correction {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO corrections (id, incorrect, correct, category, paths, confidence, source, session_id, memory_entry_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      correction.incorrect,
      correction.correct,
      correction.category,
      correction.paths ? JSON.stringify(correction.paths) : null,
      correction.confidence,
      correction.source,
      correction.session_id ?? null,
      correction.memory_entry_id ?? null,
    );

    return { ...correction, id, created_at: now };
  }

  getCorrections(filters?: { source?: string; minConfidence?: number; limit?: number }): Correction[] {
    let sql = 'SELECT * FROM corrections WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.source) {
      sql += ' AND source = ?';
      params.push(filters.source);
    }
    if (filters?.minConfidence !== undefined) {
      sql += ' AND confidence >= ?';
      params.push(filters.minConfidence);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as CorrectionRow[];
    return rows.map(r => ({
      id: r.id,
      incorrect: r.incorrect,
      correct: r.correct,
      category: r.category as MemoryCategory,
      paths: r.paths ? JSON.parse(r.paths) : undefined,
      confidence: r.confidence,
      source: r.source as Correction['source'],
      session_id: r.session_id ?? undefined,
      created_at: r.created_at,
      memory_entry_id: r.memory_entry_id ?? undefined,
    }));
  }

  // --- Analytics ---

  getUsageStats(entryId: string): { total: number; last30Days: number; lastAccess: string | null } {
    const total = this.db.prepare('SELECT COUNT(*) as c FROM usage_log WHERE entry_id = ?').get(entryId) as { c: number };
    const recent = this.db.prepare(
      "SELECT COUNT(*) as c FROM usage_log WHERE entry_id = ? AND accessed_at >= datetime('now', '-30 days')"
    ).get(entryId) as { c: number };
    const last = this.db.prepare(
      'SELECT MAX(accessed_at) as last_access FROM usage_log WHERE entry_id = ?'
    ).get(entryId) as { last_access: string | null };

    return {
      total: total.c,
      last30Days: recent.c,
      lastAccess: last.last_access,
    };
  }

  getCategoryDistribution(): Record<string, number> {
    const rows = this.db.prepare(
      'SELECT category, COUNT(*) as count FROM memory_entries GROUP BY category'
    ).all() as { category: string; count: number }[];

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.category] = row.count;
    }
    return result;
  }

  getEntryCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM memory_entries').get() as { c: number };
    return row.c;
  }

  // --- Helpers ---

  private rowToEntry(row: MemoryEntryRow, targets: SyncTarget[]): MemoryEntry {
    return {
      id: row.id,
      content: row.content,
      category: row.category as MemoryCategory,
      scope: {
        level: row.scope_level as MemoryScope['level'],
        project: row.scope_project ?? undefined,
        directory: row.scope_directory ?? undefined,
      } as MemoryScope,
      paths: row.paths ? JSON.parse(row.paths) : undefined,
      source: {
        type: row.source_type as MemorySource['type'],
        file_path: row.source_file_path,
      },
      targets,
      created_at: row.created_at,
      updated_at: row.updated_at,
      use_count: row.use_count,
      staleness_score: row.staleness_score,
      supersedes: row.supersedes ?? undefined,
      tags: JSON.parse(row.tags),
      content_hash: row.content_hash,
    };
  }
}

// Simple glob matching (supports * and **)
function matchGlob(pattern: string, filepath: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(filepath);
}

// Row types for SQLite
interface MemoryEntryRow {
  id: string;
  content: string;
  category: string;
  scope_level: string;
  scope_project: string | null;
  scope_directory: string | null;
  paths: string | null;
  source_type: string;
  source_file_path: string;
  created_at: string;
  updated_at: string;
  use_count: number;
  staleness_score: number;
  supersedes: string | null;
  tags: string;
  content_hash: string;
}

interface SyncTargetRow {
  id: number;
  entry_id: string;
  target_type: string;
  target_file_path: string;
  hash_at_sync: string;
}

interface SyncStateRow {
  id: string;
  source_file: string;
  target_file: string;
  source_hash: string;
  target_hash: string;
  last_synced_at: string;
  direction: string;
}

interface CorrectionRow {
  id: string;
  incorrect: string;
  correct: string;
  category: string;
  paths: string | null;
  confidence: number;
  source: string;
  session_id: string | null;
  created_at: string;
  memory_entry_id: string | null;
}
