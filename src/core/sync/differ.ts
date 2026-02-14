import { contentHash } from '../hash.js';
import type { ParsedEntry, ParsedSection } from '../types.js';

export interface DiffResult {
  added: ParsedEntry[];
  removed: ParsedEntry[];
  modified: ModifiedEntry[];
  unchanged: ParsedEntry[];
}

export interface ModifiedEntry {
  source: ParsedEntry;
  target: ParsedEntry;
  similarity: number;
}

export function diffSections(
  sourceSections: ParsedSection[],
  targetSections: ParsedSection[],
): DiffResult {
  const sourceEntries = flattenEntries(sourceSections);
  const targetEntries = flattenEntries(targetSections);

  return diffEntries(sourceEntries, targetEntries);
}

export function diffEntries(
  sourceEntries: ParsedEntry[],
  targetEntries: ParsedEntry[],
): DiffResult {
  const sourceHashes = new Map(sourceEntries.map(e => [contentHash(e.content), e]));
  const targetHashes = new Map(targetEntries.map(e => [contentHash(e.content), e]));

  const added: ParsedEntry[] = [];
  const removed: ParsedEntry[] = [];
  const modified: ModifiedEntry[] = [];
  const unchanged: ParsedEntry[] = [];

  // Find exact matches (unchanged) and entries only in source (added to target)
  for (const [hash, entry] of sourceHashes) {
    if (targetHashes.has(hash)) {
      unchanged.push(entry);
    } else {
      // Check for similar entries (modified)
      const similar = findMostSimilar(entry, [...targetHashes.values()]);
      if (similar && similar.similarity > 0.5) {
        modified.push({
          source: entry,
          target: similar.entry,
          similarity: similar.similarity,
        });
        targetHashes.delete(contentHash(similar.entry.content));
      } else {
        added.push(entry);
      }
    }
  }

  // Remaining target entries that weren't matched
  for (const [hash, entry] of targetHashes) {
    if (!sourceHashes.has(hash)) {
      const alreadyModified = modified.some(
        m => contentHash(m.target.content) === hash
      );
      if (!alreadyModified) {
        removed.push(entry);
      }
    }
  }

  return { added, removed, modified, unchanged };
}

function flattenEntries(sections: ParsedSection[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  for (const section of sections) {
    if (!section.managed) {
      entries.push(...section.entries);
    }
  }
  return entries;
}

function findMostSimilar(
  entry: ParsedEntry,
  candidates: ParsedEntry[],
): { entry: ParsedEntry; similarity: number } | null {
  let best: { entry: ParsedEntry; similarity: number } | null = null;

  for (const candidate of candidates) {
    const sim = similarity(entry.content, candidate.content);
    if (!best || sim > best.similarity) {
      best = { entry: candidate, similarity: sim };
    }
  }

  return best;
}

// Jaccard similarity on word tokens
function similarity(a: string, b: string): number {
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
}
