import { describe, it, expect } from 'vitest';
import { analyzeEntries, estimateTokens } from '../../../src/core/optimizer/analyzer.js';
import type { ParsedSection, ParsedEntry } from '../../../src/core/types.js';

function makeSection(heading: string, entries: string[]): ParsedSection {
  const parsedEntries: ParsedEntry[] = entries.map(e => ({
    content: e,
    level: 2,
    tags: [],
  }));

  return {
    heading,
    level: 2,
    content: entries.join('\n'),
    entries: parsedEntries,
    managed: false,
  };
}

describe('analyzeEntries', () => {
  it('should classify critical rules as always_load', () => {
    const sections = [
      makeSection('Security', [
        'Never commit .env files to git',
        'API keys must be stored in environment variables',
      ]),
    ];

    const analyzed = analyzeEntries(sections);

    const alwaysLoad = analyzed.filter(a => a.classification === 'always_load');
    expect(alwaysLoad.length).toBeGreaterThan(0);
  });

  it('should classify test-related entries as path_scoped or domain_specific', () => {
    const sections = [
      makeSection('Testing', [
        'Run tests with vitest',
        'Test files should use .test.ts extension',
      ]),
    ];

    const analyzed = analyzeEntries(sections);

    const nonAlways = analyzed.filter(a =>
      a.classification === 'path_scoped' || a.classification === 'domain_specific'
    );
    expect(nonAlways.length).toBeGreaterThan(0);
  });

  it('should skip managed sections', () => {
    const sections: ParsedSection[] = [
      {
        heading: 'Synced',
        level: 2,
        content: '- Synced entry',
        entries: [{ content: '- Synced entry', level: 2, tags: [] }],
        managed: true,
        managedId: 'synced',
      },
      makeSection('Rules', ['Always use strict mode']),
    ];

    const analyzed = analyzeEntries(sections);

    // Should not include the managed section entries
    expect(analyzed.some(a => a.entry.content.includes('Synced'))).toBe(false);
  });

  it('should suggest paths for domain-specific entries', () => {
    const sections = [
      makeSection('Vue', [
        'Use Vue 3 composition API for all components',
      ]),
    ];

    const analyzed = analyzeEntries(sections);
    const vueEntry = analyzed.find(a => a.entry.content.includes('Vue'));

    expect(vueEntry).toBeDefined();
    expect(vueEntry!.suggestedPaths.length).toBeGreaterThan(0);
    expect(vueEntry!.suggestedPaths.some(p => p.includes('.vue'))).toBe(true);
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens at ~4 chars per token', () => {
    const text = 'Hello world this is a test';
    const estimate = estimateTokens(text);

    expect(estimate).toBeGreaterThan(0);
    expect(estimate).toBe(Math.ceil(text.length / 4));
  });

  it('should handle empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});
