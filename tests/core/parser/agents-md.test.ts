import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { parseAgentsMd } from '../../../src/core/parser/agents-md.js';

const FIXTURES_DIR = join(__dirname, '../../fixtures');

describe('parseAgentsMd', () => {
  it('should parse a sample AGENTS.md file', () => {
    const doc = parseAgentsMd(join(FIXTURES_DIR, 'sample-agents.md'));

    expect(doc.sections.length).toBeGreaterThan(0);
    expect(doc.filePath).toContain('sample-agents.md');
    expect(doc.type).toBe('agents_md');
  });

  it('should extract sections with headings', () => {
    const doc = parseAgentsMd(join(FIXTURES_DIR, 'sample-agents.md'));

    const headings = doc.sections
      .filter(s => s.heading)
      .map(s => s.heading);

    expect(headings).toContain('Code Quality');
    expect(headings).toContain('API Design');
    expect(headings).toContain('Testing');
  });

  it('should extract entries from sections', () => {
    const doc = parseAgentsMd(join(FIXTURES_DIR, 'sample-agents.md'));

    const apiSection = doc.sections.find(s => s.heading === 'API Design');
    expect(apiSection).toBeDefined();
    expect(apiSection!.entries.length).toBeGreaterThan(0);
  });

  it('should return empty document for non-existent file', () => {
    const doc = parseAgentsMd('/nonexistent/AGENTS.md');
    expect(doc.sections).toEqual([]);
    expect(doc.raw).toBe('');
  });
});
