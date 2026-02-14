import { describe, it, expect } from 'vitest';
import {
  translateEntryToAgents,
  translateEntryToClaude,
  shouldSync,
  categorizeForSync,
} from '../../../src/core/sync/translator.js';
import type { ParsedEntry } from '../../../src/core/types.js';

function makeEntry(content: string): ParsedEntry {
  return { content, level: 0, tags: [] };
}

describe('translateEntryToAgents', () => {
  it('should translate Claude-specific language', () => {
    const entry = makeEntry('Claude Code should always use ESM imports');
    const translated = translateEntryToAgents(entry);

    expect(translated.content).toContain('AI assistant should');
    expect(translated.content).not.toContain('Claude Code should');
  });

  it('should preserve generic content unchanged', () => {
    const entry = makeEntry('Always use parameterized SQL queries');
    const translated = translateEntryToAgents(entry);

    expect(translated.content).toBe('Always use parameterized SQL queries');
  });
});

describe('translateEntryToClaude', () => {
  it('should translate generic AI references to Claude-specific', () => {
    const entry = makeEntry('The AI assistant should use ESM imports');
    const translated = translateEntryToClaude(entry);

    expect(translated.content).toContain('Claude Code should');
  });
});

describe('shouldSync', () => {
  it('should sync generic coding rules', () => {
    expect(shouldSync(makeEntry('Always use TypeScript strict mode'))).toBe(true);
  });

  it('should not sync Claude-specific MCP config', () => {
    expect(shouldSync(makeEntry('MCP server for Claude needs stdio transport'))).toBe(false);
  });

  it('should not sync very short entries', () => {
    expect(shouldSync(makeEntry('test'))).toBe(false);
  });
});

describe('categorizeForSync', () => {
  it('should categorize generic rules as universal', () => {
    expect(categorizeForSync(makeEntry('Always use parameterized queries'))).toBe('universal');
  });

  it('should categorize .claude/rules references as claude_only', () => {
    expect(categorizeForSync(makeEntry('Check .claude/rules for path-specific conventions'))).toBe('claude_only');
  });

  it('should categorize AGENTS.override references as agents_only', () => {
    expect(categorizeForSync(makeEntry('AGENTS.override.md replaces the base file'))).toBe('agents_only');
  });
});
