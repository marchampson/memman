import { describe, it, expect } from 'vitest';
import { diffEntries, diffSections } from '../../../src/core/sync/differ.js';
import type { ParsedEntry, ParsedSection } from '../../../src/core/types.js';

function makeEntry(content: string): ParsedEntry {
  return { content, level: 0, tags: [] };
}

function makeSection(heading: string, entries: ParsedEntry[]): ParsedSection {
  return {
    heading,
    level: 2,
    content: entries.map(e => e.content).join('\n'),
    entries,
    managed: false,
  };
}

describe('diffEntries', () => {
  it('should detect added entries', () => {
    const source = [
      makeEntry('Always use TypeScript strict mode'),
      makeEntry('Run database migrations before deploying'),
      makeEntry('Use Docker for production environments'),
    ];
    const target = [makeEntry('Always use TypeScript strict mode')];

    const diff = diffEntries(source, target);

    expect(diff.unchanged.length).toBe(1);
    // The two new entries should be detected as added (not modified, since
    // they're quite different from the existing target entry)
    expect(diff.added.length).toBe(2);
  });

  it('should detect removed entries', () => {
    const source = [makeEntry('Rule A')];
    const target = [makeEntry('Rule A'), makeEntry('Rule B')];

    const diff = diffEntries(source, target);

    expect(diff.unchanged.length).toBe(1);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].content).toBe('Rule B');
  });

  it('should detect modified entries via similarity', () => {
    const source = [makeEntry('Always use TypeScript strict mode for all files')];
    const target = [makeEntry('Use TypeScript strict mode for all project files')];

    const diff = diffEntries(source, target);

    // These should be detected as modified (similar but not identical)
    expect(diff.modified.length).toBe(1);
    expect(diff.modified[0].similarity).toBeGreaterThan(0.5);
  });

  it('should detect identical entries as unchanged', () => {
    const source = [makeEntry('Rule A'), makeEntry('Rule B')];
    const target = [makeEntry('Rule A'), makeEntry('Rule B')];

    const diff = diffEntries(source, target);

    expect(diff.unchanged.length).toBe(2);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });

  it('should handle empty arrays', () => {
    const diff = diffEntries([], []);
    expect(diff.unchanged.length).toBe(0);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });
});

describe('diffSections', () => {
  it('should skip managed sections', () => {
    const source: ParsedSection[] = [
      makeSection('Rules', [makeEntry('Rule A')]),
      {
        ...makeSection('Synced', [makeEntry('Synced entry')]),
        managed: true,
        managedId: 'synced',
      },
    ];

    const target: ParsedSection[] = [
      makeSection('Rules', [makeEntry('Rule A')]),
    ];

    const diff = diffSections(source, target);

    // The managed section should be excluded from diff
    expect(diff.unchanged.length).toBe(1);
    expect(diff.added.length).toBe(0);
  });
});
