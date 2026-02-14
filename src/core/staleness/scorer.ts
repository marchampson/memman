import { existsSync } from 'node:fs';
import { MemoryRepository } from '../db/repository.js';
import type { MemoryEntry, StalenessResult } from '../types.js';

const MAX_AGE_DAYS = 365;

export function scoreEntry(
  entry: MemoryEntry,
  db: MemoryRepository,
  referencedFilesExist?: (paths: string[]) => boolean,
): StalenessResult {
  const ageFactor = calculateAgeFactor(entry.updated_at);
  const usageFactor = calculateUsageFactor(entry, db);
  const contradictionFactor = calculateContradictionFactor(entry, referencedFilesExist);

  const score = ageFactor * (1 - usageFactor) * contradictionFactor;
  const clampedScore = Math.max(0, Math.min(1, score));

  return {
    entry,
    score: clampedScore,
    factors: {
      age: ageFactor,
      usage: usageFactor,
      contradiction: contradictionFactor,
    },
    recommendation: getRecommendation(clampedScore),
  };
}

export function scoreAllEntries(
  db: MemoryRepository,
  projectRoot?: string,
): StalenessResult[] {
  const entries = db.getAllEntries();

  const fileExistChecker = projectRoot
    ? (paths: string[]) => paths.some(p => {
        try { return existsSync(`${projectRoot}/${p}`); } catch { return false; }
      })
    : undefined;

  return entries.map(entry => scoreEntry(entry, db, fileExistChecker));
}

function calculateAgeFactor(updatedAt: string): number {
  const updated = new Date(updatedAt);
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);

  // Normalize to 0-1 over MAX_AGE_DAYS
  return Math.min(1, daysSinceUpdate / MAX_AGE_DAYS);
}

function calculateUsageFactor(entry: MemoryEntry, db: MemoryRepository): number {
  const stats = db.getUsageStats(entry.id);

  // More recent and frequent usage = higher usage factor (lower staleness)
  if (stats.total === 0) return 0;

  // Weight recent usage more heavily
  const recentWeight = stats.last30Days / Math.max(stats.total, 1);
  const totalNormalized = Math.min(1, stats.total / 50); // Cap at 50 uses

  return (recentWeight * 0.7 + totalNormalized * 0.3);
}

function calculateContradictionFactor(
  entry: MemoryEntry,
  fileExistChecker?: (paths: string[]) => boolean,
): number {
  // Base factor: 1.0 (no contradiction)
  let factor = 1.0;

  // Check if referenced files still exist
  if (entry.paths && entry.paths.length > 0 && fileExistChecker) {
    const filesExist = fileExistChecker(entry.paths);
    if (!filesExist) {
      factor = 2.0; // Double staleness if referenced files are gone
    }
  }

  // Check if entry references specific tools/versions that may be outdated
  const content = entry.content.toLowerCase();
  if (content.includes('deprecated')) factor *= 1.5;
  if (content.includes('temporary') || content.includes('todo') || content.includes('fixme')) factor *= 1.3;

  return factor;
}

function getRecommendation(score: number): StalenessResult['recommendation'] {
  if (score < 0.3) return 'fresh';
  if (score < 0.6) return 'review';
  if (score < 0.8) return 'demote';
  return 'delete';
}

export function getStaleEntries(
  db: MemoryRepository,
  threshold = 0.5,
  projectRoot?: string,
): StalenessResult[] {
  const results = scoreAllEntries(db, projectRoot);
  return results
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
