import { existsSync, readFileSync } from 'node:fs';
import { parseClaudeMd } from '../parser/claude-md.js';
import { parseAgentsMd } from '../parser/agents-md.js';
import { diffSections } from './differ.js';
import { translateEntryToAgents, translateEntryToClaude, shouldSync, categorizeForSync } from './translator.js';
import { writeManagedSection } from './writer.js';
import { contentHash, fileHash } from '../hash.js';
import { MemoryRepository } from '../db/repository.js';
import type {
  SyncDirection,
  SyncResult,
  SyncConflict,
  ParsedEntry,
  MemoryCategory,
} from '../types.js';

const MANAGED_ID = 'synced';

export interface SyncOptions {
  claudeMdPath: string;
  agentsMdPath: string;
  direction: SyncDirection;
  dryRun: boolean;
  projectRoot: string;
  db: MemoryRepository;
}

export function sync(options: SyncOptions): SyncResult {
  const { claudeMdPath, agentsMdPath, direction, dryRun, db } = options;

  const claudeDoc = parseClaudeMd(claudeMdPath);
  const agentsDoc = parseAgentsMd(agentsMdPath);

  // Get only user-authored (non-managed) sections for diffing
  const claudeUserSections = claudeDoc.sections.filter(s => !s.managed);
  const agentsUserSections = agentsDoc.sections.filter(s => !s.managed);

  const diff = diffSections(claudeUserSections, agentsUserSections);

  const result: SyncResult = {
    entriesAdded: 0,
    entriesUpdated: 0,
    entriesRemoved: 0,
    conflicts: [],
    dryRun,
  };

  // Check for conflicts: both files modified since last sync
  const syncState = db.getSyncState(claudeMdPath, agentsMdPath);
  if (syncState && direction === 'bidirectional') {
    const currentClaudeHash = existsSync(claudeMdPath) ? fileHash(readFileSync(claudeMdPath, 'utf-8')) : '';
    const currentAgentsHash = existsSync(agentsMdPath) ? fileHash(readFileSync(agentsMdPath, 'utf-8')) : '';

    const claudeChanged = currentClaudeHash !== syncState.source_hash;
    const agentsChanged = currentAgentsHash !== syncState.target_hash;

    if (claudeChanged && agentsChanged) {
      // Both changed - check for actual conflicts in modified entries
      for (const mod of diff.modified) {
        result.conflicts.push({
          entryId: contentHash(mod.source.content),
          sourceContent: mod.source.content,
          targetContent: mod.target.content,
        });
      }
    }
  }

  if (dryRun) {
    result.entriesAdded = diff.added.length;
    result.entriesRemoved = diff.removed.length;
    result.entriesUpdated = diff.modified.length;
    return result;
  }

  // Perform the sync based on direction
  if (direction === 'claude-to-agents' || direction === 'bidirectional') {
    const entriesToSync = diff.added
      .filter(shouldSync)
      .filter(e => categorizeForSync(e) !== 'agents_only')
      .map(translateEntryToAgents);

    if (entriesToSync.length > 0) {
      writeManagedSection(agentsMdPath, MANAGED_ID, 'Synced from CLAUDE.md', entriesToSync);
      result.entriesAdded += entriesToSync.length;

      // Persist to DB
      for (const entry of entriesToSync) {
        const hash = contentHash(entry.content);
        const existing = db.getEntryByHash(hash);
        if (!existing) {
          db.createEntry({
            content: entry.content,
            category: inferCategory(entry),
            scope: { level: 'project', project: options.projectRoot },
            paths: entry.paths,
            source: { type: 'claude_md', file_path: claudeMdPath },
            targets: [{ type: 'agents_md', file_path: agentsMdPath, hash_at_sync: hash }],
            tags: entry.tags,
            content_hash: hash,
            supersedes: undefined,
          });
        }
      }
    }
  }

  if (direction === 'agents-to-claude' || direction === 'bidirectional') {
    const entriesToSync = diff.removed
      .filter(shouldSync)
      .filter(e => categorizeForSync(e) !== 'claude_only')
      .map(translateEntryToClaude);

    if (entriesToSync.length > 0) {
      writeManagedSection(claudeMdPath, MANAGED_ID, 'Synced from AGENTS.md', entriesToSync);
      result.entriesAdded += entriesToSync.length;

      for (const entry of entriesToSync) {
        const hash = contentHash(entry.content);
        const existing = db.getEntryByHash(hash);
        if (!existing) {
          db.createEntry({
            content: entry.content,
            category: inferCategory(entry),
            scope: { level: 'project', project: options.projectRoot },
            paths: entry.paths,
            source: { type: 'agents_md', file_path: agentsMdPath },
            targets: [{ type: 'claude_md', file_path: claudeMdPath, hash_at_sync: hash }],
            tags: entry.tags,
            content_hash: hash,
            supersedes: undefined,
          });
        }
      }
    }
  }

  // Handle modified entries (update managed sections)
  for (const mod of diff.modified) {
    if (result.conflicts.some(c => c.entryId === contentHash(mod.source.content))) {
      continue; // Skip conflicted entries
    }
    result.entriesUpdated++;
  }

  // Update sync state
  const newClaudeHash = existsSync(claudeMdPath) ? fileHash(readFileSync(claudeMdPath, 'utf-8')) : '';
  const newAgentsHash = existsSync(agentsMdPath) ? fileHash(readFileSync(agentsMdPath, 'utf-8')) : '';

  if (syncState) {
    db.updateSyncStateHashes(claudeMdPath, agentsMdPath, newClaudeHash, newAgentsHash);
  } else {
    db.upsertSyncState({
      source_file: claudeMdPath,
      target_file: agentsMdPath,
      source_hash: newClaudeHash,
      target_hash: newAgentsHash,
      last_synced_at: new Date().toISOString(),
      direction,
    });
  }

  return result;
}

export function getSyncDrift(
  claudeMdPath: string,
  agentsMdPath: string,
  db: MemoryRepository,
): { drifted: boolean; claudeChanged: boolean; agentsChanged: boolean } {
  const syncState = db.getSyncState(claudeMdPath, agentsMdPath);

  if (!syncState) {
    return { drifted: true, claudeChanged: true, agentsChanged: true };
  }

  const currentClaudeHash = existsSync(claudeMdPath) ? fileHash(readFileSync(claudeMdPath, 'utf-8')) : '';
  const currentAgentsHash = existsSync(agentsMdPath) ? fileHash(readFileSync(agentsMdPath, 'utf-8')) : '';

  return {
    drifted: currentClaudeHash !== syncState.source_hash || currentAgentsHash !== syncState.target_hash,
    claudeChanged: currentClaudeHash !== syncState.source_hash,
    agentsChanged: currentAgentsHash !== syncState.target_hash,
  };
}

function inferCategory(entry: ParsedEntry): MemoryCategory {
  const lower = entry.content.toLowerCase();

  if (entry.tags.includes('testing')) return 'testing';
  if (entry.tags.includes('security')) return 'security';
  if (entry.tags.includes('database')) return 'architecture';
  if (entry.tags.includes('api')) return 'architecture';
  if (entry.tags.includes('devops')) return 'workflow';

  if (lower.includes('never') || lower.includes('always') || lower.includes('must')) return 'coding_standard';
  if (lower.includes('prefer') || lower.includes('use ')) return 'convention';
  if (lower.includes('run ') || lower.includes('command')) return 'command';
  if (lower.includes('install') || lower.includes('package')) return 'dependency';

  return 'convention';
}

export { MANAGED_ID };
